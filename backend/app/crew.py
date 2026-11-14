"""Crew record: the (fictional) crew roster, the monitored astronaut's profile, measurement history at each time, and exports.

The profile is a SIMULATED crew member (no real person's data). Baselines are computed from the
stored readings the same way AEGIS does (rest + good signal), so the record and the alerts agree.
"""
from __future__ import annotations

import csv
import io
from datetime import datetime, timedelta, timezone

from psycopg_pool import ConnectionPool

# FICTIONAL crew (invented names; any likeness to real people is coincidental). Only crew-01 wears the
# simulated wrist sensor in this demo; the others are listed so the record reads like a real crew roster.
_COMMON = {"mission": "AEGIS-1 (simulated deep-space transit)", "simulated": True, "fictional": True}
CREW = {
    "crew-01": {"astronaut_id": "crew-01", "name": "Aylin Kaya", "sex": "Female", "age": 38,
                "nationality": "Turkey", "country_code": "TR", "role": "Flight engineer",
                "height_cm": 168, "mass_kg": 61, "blood_type": "A+", "allergies": "None known",
                "medications": "None", "monitored": True,
                "sensor": "Wrist sensor, heart rate + SpO2, BLE (simulated)", "sampling": "1 reading per second"},
    "crew-02": {"astronaut_id": "crew-02", "name": "Daniel Okello", "sex": "Male", "age": 44,
                "nationality": "Uganda", "country_code": "UG", "role": "Commander",
                "height_cm": 181, "mass_kg": 78, "blood_type": "O+", "allergies": "Penicillin",
                "medications": "None", "monitored": False},
    "crew-03": {"astronaut_id": "crew-03", "name": "Emily Carter", "sex": "Female", "age": 36,
                "nationality": "United States", "country_code": "US", "role": "Crew medical officer",
                "height_cm": 166, "mass_kg": 60, "blood_type": "B+", "allergies": "None known",
                "medications": "None", "monitored": False},
}
for _c in CREW.values():
    _c.update(_COMMON)


def roster() -> list[dict]:
    return list(CREW.values())


READING_COLS = ["ts", "heart_rate", "spo2", "activity", "signal_quality", "source"]
ALERT_COLS = ["ts", "alert_id", "metric", "value", "baseline", "deviation", "severity", "reason", "activity", "signal_quality"]
CHECKIN_COLS = ["ts", "feeling", "symptom"]
DATASETS = ("readings", "alerts", "checkins")
MAX_ROWS = 200_000          # export cap (~2.3 days at 1 Hz)


def profile(astronaut_id: str) -> dict:
    return CREW.get(astronaut_id) or {**_COMMON, "astronaut_id": astronaut_id, "name": astronaut_id, "monitored": True}


def _range(start: datetime | None, end: datetime | None) -> tuple[datetime, datetime]:
    # open-ended by default: simulated batches are stamped 1 s apart from now, so some lie slightly ahead
    end = end or datetime(9999, 1, 1, tzinfo=timezone.utc)
    start = start or datetime(1970, 1, 1, tzinfo=timezone.utc)
    return start, end


def summary(pool: ConnectionPool, astronaut_id: str) -> dict:
    """Profile + personal baselines + record coverage."""
    with pool.connection() as conn:
        cov = conn.execute(
            "SELECT count(*) AS readings, min(ts) AS first, max(ts) AS last FROM readings WHERE astronaut_id = %s",
            (astronaut_id,)).fetchone()
        base = conn.execute(
            "SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY heart_rate) AS hr_rest, "
            "percentile_cont(0.5) WITHIN GROUP (ORDER BY spo2) AS spo2_rest, "
            "min(heart_rate) AS hr_min, max(heart_rate) AS hr_max FROM ("
            "  SELECT heart_rate, spo2 FROM readings WHERE astronaut_id = %s AND activity = 'rest' "
            "  AND signal_quality = 'good' ORDER BY ts DESC LIMIT 3600) r",
            (astronaut_id,)).fetchone()
        sev = conn.execute(
            "SELECT severity, count(*) AS n FROM alerts WHERE astronaut_id = %s GROUP BY severity",
            (astronaut_id,)).fetchall()
        chk = conn.execute(
            "SELECT ts, feeling, symptom FROM checkins WHERE astronaut_id = %s ORDER BY ts DESC LIMIT 1",
            (astronaut_id,)).fetchone()
    r = lambda v: None if v is None else round(float(v), 1)
    return {
        "profile": profile(astronaut_id),
        "crew": roster(),
        "baseline": {"heart_rate_rest": r(base["hr_rest"]), "spo2_rest": r(base["spo2_rest"]),
                     "window": "last 3600 resting readings with good signal"},
        "record": {"readings": cov["readings"], "first": cov["first"], "last": cov["last"],
                   "alerts": {s["severity"]: s["n"] for s in sev}, "last_checkin": chk},
    }


def history(pool: ConnectionPool, astronaut_id: str, start: datetime | None, end: datetime | None,
            step_s: int = 0, limit: int = 500, before: datetime | None = None) -> dict:
    """Readings in [start, end], newest first. step_s > 0 averages them into buckets of that many seconds."""
    start, end = _range(start, end)
    if before:
        end = min(end, before - timedelta(microseconds=1))
    with pool.connection() as conn:
        if step_s > 0:
            rows = conn.execute(
                "SELECT date_bin(make_interval(secs => %s), ts, TIMESTAMPTZ '2000-01-01') AS ts, "
                "round(avg(heart_rate)::numeric, 1)::float AS heart_rate, round(min(heart_rate)::numeric, 1)::float AS heart_rate_min, "
                "round(max(heart_rate)::numeric, 1)::float AS heart_rate_max, round(avg(spo2)::numeric, 1)::float AS spo2, "
                "round(min(spo2)::numeric, 1)::float AS spo2_min, mode() WITHIN GROUP (ORDER BY activity) AS activity, "
                "count(*) AS samples, count(*) FILTER (WHERE signal_quality <> 'good') AS poor_signal "
                "FROM readings WHERE astronaut_id = %s AND ts BETWEEN %s AND %s GROUP BY 1 ORDER BY 1 DESC LIMIT %s",
                (step_s, astronaut_id, start, end, limit)).fetchall()
        else:
            rows = conn.execute(
                f"SELECT {', '.join(READING_COLS)} FROM readings WHERE astronaut_id = %s AND ts BETWEEN %s AND %s "
                "ORDER BY ts DESC LIMIT %s", (astronaut_id, start, end, limit)).fetchall()
        total = conn.execute("SELECT count(*) AS n FROM readings WHERE astronaut_id = %s AND ts BETWEEN %s AND %s",
                             (astronaut_id, start, end)).fetchone()["n"]
        alerts = conn.execute(
            f"SELECT {', '.join(ALERT_COLS)} FROM alerts WHERE astronaut_id = %s AND ts BETWEEN %s AND %s ORDER BY ts DESC LIMIT 200",
            (astronaut_id, start, end)).fetchall()
        checkins = conn.execute(
            f"SELECT {', '.join(CHECKIN_COLS)} FROM checkins WHERE astronaut_id = %s AND ts BETWEEN %s AND %s ORDER BY ts DESC LIMIT 200",
            (astronaut_id, start, end)).fetchall()
    return {"astronaut_id": astronaut_id, "start": start, "end": end, "step_s": step_s, "total_readings": total,
            "readings": rows, "alerts": alerts, "checkins": checkins,
            "next_before": rows[-1]["ts"] if len(rows) == limit else None}


def rows_for(pool: ConnectionPool, dataset: str, astronaut_id: str, start: datetime | None, end: datetime | None) -> tuple[list[str], list[dict]]:
    start, end = _range(start, end)
    cols = {"readings": READING_COLS, "alerts": ALERT_COLS, "checkins": CHECKIN_COLS}[dataset]
    with pool.connection() as conn:
        rows = conn.execute(
            f"SELECT {', '.join(cols)} FROM {dataset} WHERE astronaut_id = %s AND ts BETWEEN %s AND %s ORDER BY ts LIMIT %s",
            (astronaut_id, start, end, MAX_ROWS)).fetchall()
    return cols, rows


def to_csv(cols: list[str], rows: list[dict], astronaut_id: str) -> str:
    buf = io.StringIO()
    buf.write(f"# AEGIS-MEDLINK crew record export: {astronaut_id} (SIMULATED data, not a medical device)\n")
    w = csv.writer(buf)
    w.writerow(["astronaut_id", *cols])
    for r in rows:
        w.writerow([astronaut_id, *[r[c].isoformat() if isinstance(r[c], datetime) else ("" if r[c] is None else r[c]) for c in cols]])
    return buf.getvalue()
