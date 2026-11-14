"""NASA DONKI space weather: the real NASA data AEGIS uses for environmental risk.

DONKI (Space Weather Database Of Notifications, Knowledge, Information) reports solar energetic
particle events (SEP), coronal mass ejections (CME), geomagnetic storms (GST) and radiation belt
enhancements (RBE). AEGIS turns recent events into an environment status for the crew.

This is environmental risk near Earth/the inner heliosphere, not a measured crew radiation dose.
Events are stored in Postgres; a bundled snapshot (backend/data/donki) keeps the demo working offline.
"""
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

import httpx
from psycopg.types.json import Jsonb
from psycopg_pool import ConnectionPool

API = "https://api.nasa.gov/DONKI"
KINDS = ("SEP", "CME", "GST", "RBE")
SNAPSHOT_DIR = Path(__file__).resolve().parent.parent / "data" / "donki"
FAST_CME_KMS = 1000           # fast CMEs are the ones that tend to drive particle events and storms
STRONG_STORM_KP = 7
SEVERITY_ORDER = ("nominal", "info", "caution", "warning")

# How long an event keeps influencing the crew's environment status.
WINDOW = {"SEP": timedelta(hours=72), "RBE": timedelta(hours=48), "CME": timedelta(hours=72),
          "GST": timedelta(hours=48)}

# Crew guidance for a particle event (placeholders until reviewed by a flight surgeon).
SEP_TODO = ["Move to the most shielded module", "Keep your personal dosimeter on", "Postpone any EVA"]


class DonkiError(RuntimeError):
    pass


def fetch(kind: str, start: datetime, end: datetime, api_key: str, client: httpx.Client | None = None) -> list[dict]:
    """One DONKI query. Raises DonkiError on HTTP errors or rate limiting."""
    if kind not in KINDS:
        raise ValueError(f"kind must be one of {KINDS}")
    params = {"startDate": start.date().isoformat(), "endDate": end.date().isoformat(), "api_key": api_key}
    c = client or httpx.Client(timeout=30)
    try:
        r = c.get(f"{API}/{kind}", params=params)
    except httpx.HTTPError as e:
        raise DonkiError(f"DONKI unreachable: {e}") from e
    if r.status_code == 429:
        raise DonkiError("DONKI rate limit reached (set NASA_API_KEY in backend/.env)")
    if r.status_code != 200:
        raise DonkiError(f"DONKI {kind} returned HTTP {r.status_code}")
    data = r.json()
    return data if isinstance(data, list) else []


def normalize(kind: str, item: dict) -> dict:
    """Turn one DONKI record into the shape we store and show."""
    if kind == "SEP":
        instrument = (item.get("instruments") or [{}])[0].get("displayName", "")
        return _event(item["sepID"], kind, item["eventTime"], "warning",
                      f"Solar energetic particle event{f' ({instrument})' if instrument else ''}", item)
    if kind == "RBE":
        return _event(item["rbeID"], kind, item["eventTime"], "caution", "Radiation belt enhancement", item)
    if kind == "GST":
        kp = max((k.get("kpIndex") or 0 for k in item.get("allKpIndex") or []), default=0)
        severity = "caution" if kp >= STRONG_STORM_KP else "info"
        return _event(item["gstID"], kind, item["startTime"], severity, f"Geomagnetic storm, Kp {kp:g}", item)
    if kind == "CME":
        speed = max((a.get("speed") or 0 for a in item.get("cmeAnalyses") or []), default=0)
        severity = "caution" if speed >= FAST_CME_KMS else "info"
        where = item.get("sourceLocation") or "source unknown"
        text = f"Coronal mass ejection, {speed:.0f} km/s ({where})" if speed else f"Coronal mass ejection ({where})"
        return _event(item["activityID"], kind, item["startTime"], severity, text, item)
    raise ValueError(kind)


def _event(event_id: str, kind: str, when: str, severity: str, summary: str, raw: dict) -> dict:
    return {"event_id": event_id, "kind": kind, "start_time": _parse(when), "severity": severity,
            "summary": summary, "link": raw.get("link"), "raw": raw}


def _parse(ts: str) -> datetime:
    return datetime.fromisoformat(ts.replace("Z", "+00:00"))


def store(pool: ConnectionPool, events: list[dict], origin: str) -> int:
    """Upsert events; returns how many were new."""
    new = 0
    with pool.connection() as conn, conn.transaction():
        for e in events:
            cur = conn.execute(
                "INSERT INTO space_weather (event_id, kind, start_time, severity, summary, link, origin, raw) "
                "VALUES (%s, %s, %s, %s, %s, %s, %s, %s) ON CONFLICT (event_id) DO UPDATE SET "
                "severity = EXCLUDED.severity, summary = EXCLUDED.summary, raw = EXCLUDED.raw, fetched_at = now() "
                "RETURNING (xmax = 0) AS inserted",
                (e["event_id"], e["kind"], e["start_time"], e["severity"], e["summary"], e["link"], origin,
                 Jsonb(e["raw"])))
            new += bool(cur.fetchone()["inserted"])
    return new


def load_snapshot(pool: ConnectionPool, directory: Path = SNAPSHOT_DIR) -> int:
    """Load the bundled real DONKI responses (files named <KIND>_<start>_<end>.json)."""
    events = []
    for path in sorted(directory.glob("*.json")):
        kind = path.name.split("_")[0]
        if kind in KINDS:
            events += [normalize(kind, item) for item in json.loads(path.read_text())]
    return store(pool, events, "snapshot")


def refresh(pool: ConnectionPool, api_key: str, days: int = 30, client: httpx.Client | None = None) -> dict:
    """Fetch the last `days` of every kind from NASA. Partial failures are reported, not fatal."""
    end = datetime.now(timezone.utc)
    start = end - timedelta(days=days)
    result: dict = {"new": 0, "fetched": {}, "errors": {}}
    for kind in KINDS:
        try:
            items = fetch(kind, start, end, api_key, client)
        except DonkiError as e:
            result["errors"][kind] = str(e)
            continue
        result["fetched"][kind] = len(items)
        result["new"] += store(pool, [normalize(kind, i) for i in items], "live")
    return result


def recent(pool: ConnectionPool, as_of: datetime, days: int = 7, limit: int = 20) -> list[dict]:
    with pool.connection() as conn:
        return conn.execute(
            "SELECT event_id, kind, start_time, severity, summary, link, origin FROM space_weather "
            "WHERE start_time <= %s AND start_time > %s ORDER BY start_time DESC LIMIT %s",
            (as_of, as_of - timedelta(days=days), limit)).fetchall()


def status(pool: ConnectionPool, as_of: datetime) -> dict:
    """The crew's space-weather environment at `as_of`: worst active event wins."""
    active = [e for e in recent(pool, as_of, days=3, limit=200)
              if as_of - e["start_time"] <= WINDOW[e["kind"]]]
    worst = max(active, key=lambda e: (SEVERITY_ORDER.index(e["severity"]), e["start_time"]), default=None)
    level = worst["severity"] if worst else "nominal"
    if level == "warning":
        headline = "Solar particle event in progress: radiation risk elevated"
    elif level == "caution":
        headline = worst["summary"]
    elif active:
        headline = f"{len(active)} minor space weather event(s), no action needed"
    else:
        headline = "Quiet space weather"
    return {"level": level, "headline": headline, "active": active, "as_of": as_of,
            "todo": SEP_TODO if level == "warning" else [],
            "source": "NASA DONKI", "note": "Environmental conditions, not a measured crew dose."}
