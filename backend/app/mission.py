"""Ties the parts together: ingest a reading -> AEGIS -> PulseBrief -> MEDLINK."""
from datetime import datetime, timedelta, timezone

from psycopg.types.json import Jsonb
from psycopg_pool import ConnectionPool

from . import aegis, dtn, events, medlink, pulsebrief
from .config import Settings
from .models import Alert, CheckIn, Layer, Reading
from .simulator import Simulator

HISTORY_LIMIT = 600                 # ~10 minutes at one reading per second
ALERT_COOLDOWN = timedelta(seconds=60)
SEVERITY_ORDER = ["routine", "review", "urgent"]
LIGHT_KM_S = 299_792.458
# The DSN hands a deep-space craft from complex to complex roughly every 8 hours (by UTC hour).
GROUND_STATIONS = [
    {"name": "DSN Goldstone", "lat": 35.43, "lon": -116.89},
    {"name": "DSN Madrid", "lat": 40.43, "lon": -4.25},
    {"name": "DSN Canberra", "lat": -35.40, "lon": 148.98},
]
METRIC_LABEL = {"heart_rate": ("Heart rate", " bpm"), "spo2": ("SpO2", "%")}


def ground_station(now: datetime | None = None) -> dict:
    hour = (now or datetime.now(timezone.utc)).hour
    return GROUND_STATIONS[hour // 8]


class Mission:
    def __init__(self, pool: ConnectionPool, settings: Settings):
        self.pool = pool
        self.settings = settings
        self.sim = Simulator(astronaut_id=settings.astronaut_id)
        self.link_ctl: dtn.DockerLink | None = None
        self.receiver: dtn.Receiver | None = None
        if settings.transport == "dtn":
            self.transport = dtn.DtnTransport(settings.dtn_spacecraft_url, settings.dtn_earth_url)
            self.link_ctl = dtn.DockerLink(settings.dtn_network, settings.dtn_earth_container, settings.dtn_earth_ip)
            self.receiver = dtn.Receiver(pool, self.transport)
        else:
            self.transport = medlink.EarthInbox(pool)

    def start(self) -> None:
        if self.receiver:
            self.link_ctl.set(medlink.link(self.pool)["state"] == "up")
            self.receiver.start()

    def stop(self) -> None:
        if self.receiver:
            self.receiver.stop()

    # ---- the space link ----

    def set_link(self, state: str) -> list[str]:
        if self.link_ctl:
            self.link_ctl.set(state == "up")
        return medlink.set_link(self.pool, self.transport, state)

    def open_window(self, budget_bytes: int) -> list[str]:
        """Open the link briefly: release what fits, wait for it to arrive, then cut the link again."""
        if self.link_ctl:
            self.link_ctl.set(True)
        sent = medlink.open_window(self.pool, self.transport, budget_bytes)
        if self.link_ctl:
            dtn.wait_for(self.pool, sent)
            self.link_ctl.set(False)
        layers = [s.split(":")[1] if ":" in s else "reply" for s in sent]
        what = ", ".join(layers) if layers else "nothing fitted"
        events.log(self.pool, "window", f"Short window ({budget_bytes} B): {what}",
                   budget_bytes=budget_bytes, sent=sent)
        return sent

    def reply(self, brief_id: str, text: str) -> str:
        return medlink.reply(self.pool, self.transport, brief_id, text)

    # ---- readings and alerts ----

    def ingest(self, reading: Reading) -> dict:
        history = self.history(reading.astronaut_id)
        self._store_reading(reading)
        alert = aegis.evaluate(reading, history)
        if alert is None or self._cooling_down(alert):
            return {"reading": reading, "alert": None, "brief_id": None}
        self._store_alert(alert)
        label, unit = METRIC_LABEL.get(alert.metric, (alert.metric, ""))
        events.log(self.pool, "alert", f"{label} alert: {alert.value:g}{unit} ({alert.severity.value})",
                   alert_id=alert.alert_id, metric=alert.metric, value=alert.value, severity=alert.severity.value)
        layers = pulsebrief.build(alert, history + [reading], self.latest_checkin(reading.astronaut_id))
        brief_id = medlink.enqueue(self.pool, layers, alert.severity)
        size = sum(len(l.encode()) for l in layers)
        events.log(self.pool, "brief_queued", f"PulseBrief queued ({len(layers)} layers, {size} B)",
                   brief_id=brief_id, severity=alert.severity.value, size=size)
        medlink.flush(self.pool, self.transport)
        return {"reading": reading, "alert": alert, "brief_id": brief_id}

    def history(self, astronaut_id: str, limit: int = HISTORY_LIMIT) -> list[Reading]:
        with self.pool.connection() as conn:
            rows = conn.execute(
                "SELECT astronaut_id, ts, heart_rate, spo2, activity, signal_quality, source FROM readings "
                "WHERE astronaut_id = %s ORDER BY ts DESC LIMIT %s", (astronaut_id, limit)).fetchall()
        return [Reading(**r) for r in reversed(rows)]

    def alerts(self, astronaut_id: str, limit: int = 10) -> list[dict]:
        with self.pool.connection() as conn:
            return conn.execute("SELECT * FROM alerts WHERE astronaut_id = %s ORDER BY ts DESC LIMIT %s",
                                (astronaut_id, limit)).fetchall()

    # ---- astronaut input ----

    def checkin(self, c: CheckIn) -> dict:
        with self.pool.connection() as conn:
            conn.execute("INSERT INTO checkins (astronaut_id, feeling, symptom) VALUES (%s, %s, %s)",
                         (c.astronaut_id, c.feeling, c.symptom))
            feeling = c.feeling.replace("_", " ")
            events.add(conn, "checkin", f"Crew check-in: {feeling}" + (f", {c.symptom}" if c.symptom else ""),
                       feeling=c.feeling, symptom=c.symptom)
        refreshed = self._refresh_latest_context(c.astronaut_id)
        return {"checkin": c, "context_updated": refreshed}

    def mark_done(self, alert_id: str, step: str) -> dict:
        with self.pool.connection() as conn:
            row = conn.execute(
                "UPDATE alerts SET done = CASE WHEN done ? %s THEN done ELSE done || %s END "
                "WHERE alert_id = %s RETURNING astronaut_id, done", (step, Jsonb([step]), alert_id)).fetchone()
        if row is None:
            raise KeyError(alert_id)
        events.log(self.pool, "step_done", f"Crew did: {step}", alert_id=alert_id, step=step)
        refreshed = self._refresh_latest_context(row["astronaut_id"])
        return {"alert_id": alert_id, "done": row["done"], "context_updated": refreshed}

    def latest_checkin(self, astronaut_id: str) -> CheckIn | None:
        with self.pool.connection() as conn:
            row = conn.execute(
                "SELECT astronaut_id, feeling, symptom FROM checkins WHERE astronaut_id = %s "
                "AND ts > now() - interval '10 minutes' ORDER BY ts DESC LIMIT 1", (astronaut_id,)).fetchone()
        return CheckIn(**row) if row else None

    # ---- link timing shown to the crew ----

    def eta(self) -> dict:
        one_way, next_window = self.settings.one_way_delay_min, self.settings.next_window_min
        up = medlink.link(self.pool)["state"] == "up"
        earth_sees = one_way if up else next_window + one_way
        return {"link_up": up, "earth_sees_in_min": earth_sees, "earliest_reply_in_min": earth_sees + one_way,
                "one_way_delay_min": one_way}

    def overview(self) -> dict:
        """The whole mission at a glance, for the 3D simulation."""
        delay_s = self.settings.one_way_delay_min * 60
        with self.pool.connection() as conn:
            # sim readings run ahead of the wall clock, so take whichever is later
            row = conn.execute("SELECT extract(epoch FROM greatest(now(), max(ts)) - min(ts)) AS s "
                               "FROM readings").fetchone()
        return {
            "mission_time_s": round(float(row["s"] or 0)),
            "spacecraft": {"name": "AEGIS-1", "distance_km": round(delay_s * LIGHT_KM_S),
                           "light_delay_s": delay_s, "phase": "Cruise to Mars"},
            "link": {"state": medlink.link(self.pool)["state"]},
            "ground_station": ground_station(),
            "bpv7": self.transport.status() if self.settings.transport == "dtn" else None,
            "events": events.recent(self.pool, 40),
        }

    def stats(self) -> dict:
        with self.pool.connection() as conn:
            counts = conn.execute(
                "SELECT count(*) FILTER (WHERE status = 'queued') AS queued, "
                "count(*) FILTER (WHERE status = 'in_transit') AS in_transit, "
                "count(*) FILTER (WHERE status = 'delivered') AS delivered, "
                "count(DISTINCT brief_id) AS briefs FROM bundles").fetchone()
            readings = conn.execute("SELECT count(*) AS n FROM readings").fetchone()["n"]
        sample = self.history(self.settings.astronaut_id, limit=50)
        per_reading = pulsebrief.raw_size(sample) / len(sample) if sample else 0
        return {**counts, "bytes_sent": medlink.link(self.pool)["bytes_sent"], "readings": readings,
                "transport": self.settings.transport,
                "raw_bytes_equivalent": round(per_reading * readings)}

    # ---- internals ----

    def _store_reading(self, r: Reading) -> None:
        with self.pool.connection() as conn:
            conn.execute(
                "INSERT INTO readings (astronaut_id, ts, heart_rate, spo2, activity, signal_quality, source) "
                "VALUES (%s, %s, %s, %s, %s, %s, %s)",
                (r.astronaut_id, r.ts, r.heart_rate, r.spo2, r.activity.value, r.signal_quality.value, r.source))

    def _store_alert(self, a: Alert) -> None:
        with self.pool.connection() as conn:
            conn.execute(
                "INSERT INTO alerts (alert_id, astronaut_id, ts, metric, value, baseline, deviation, severity, "
                "reason, activity, signal_quality, todo) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)",
                (a.alert_id, a.astronaut_id, a.ts, a.metric, a.value, a.baseline, a.deviation, a.severity.value,
                 a.reason, a.activity.value, a.signal_quality.value, Jsonb(a.todo)))

    def _cooling_down(self, a: Alert) -> bool:
        """Don't repeat the same alert every second; a worse one still gets through."""
        with self.pool.connection() as conn:
            last = conn.execute(
                "SELECT ts, severity FROM alerts WHERE astronaut_id = %s AND metric = %s ORDER BY ts DESC LIMIT 1",
                (a.astronaut_id, a.metric)).fetchone()
        if last is None or a.ts - last["ts"] > ALERT_COOLDOWN:
            return False
        return SEVERITY_ORDER.index(a.severity.value) <= SEVERITY_ORDER.index(last["severity"])

    def _refresh_latest_context(self, astronaut_id: str) -> bool:
        """Put the newest check-in and done steps into the latest brief if its context hasn't left."""
        latest = self.alerts(astronaut_id, limit=1)
        if not latest:
            return False
        row = latest[0]
        alert = Alert(**{k: v for k, v in row.items() if k != "done"})
        layers = pulsebrief.build(alert, self.history(astronaut_id), self.latest_checkin(astronaut_id),
                                  row.get("done") or [])
        context = next(l for l in layers if l.layer == Layer.context)
        return medlink.update_layer(self.pool, context.payload["id"], context)
