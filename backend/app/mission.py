"""Ties the parts together: ingest a reading -> AEGIS -> PulseBrief -> MEDLINK."""
from datetime import timedelta

from psycopg.types.json import Jsonb
from psycopg_pool import ConnectionPool

from . import aegis, medlink, pulsebrief
from .config import Settings
from .models import Alert, CheckIn, Layer, Reading
from .simulator import Simulator

HISTORY_LIMIT = 600                 # ~10 minutes at one reading per second
ALERT_COOLDOWN = timedelta(seconds=60)
SEVERITY_ORDER = ["routine", "review", "urgent"]


class Mission:
    def __init__(self, pool: ConnectionPool, settings: Settings):
        self.pool = pool
        self.settings = settings
        self.earth = medlink.EarthInbox(pool)
        self.sim = Simulator(astronaut_id=settings.astronaut_id)

    # ---- readings and alerts ----

    def ingest(self, reading: Reading) -> dict:
        history = self.history(reading.astronaut_id)
        self._store_reading(reading)
        alert = aegis.evaluate(reading, history)
        if alert is None or self._cooling_down(alert):
            return {"reading": reading, "alert": None, "brief_id": None}
        self._store_alert(alert)
        layers = pulsebrief.build(alert, history + [reading], self.latest_checkin(reading.astronaut_id))
        brief_id = medlink.enqueue(self.pool, layers, alert.severity)
        medlink.flush(self.pool, self.earth)
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
        refreshed = self._refresh_latest_context(c.astronaut_id)
        return {"checkin": c, "context_updated": refreshed}

    def mark_done(self, alert_id: str, step: str) -> dict:
        with self.pool.connection() as conn:
            row = conn.execute(
                "UPDATE alerts SET done = CASE WHEN done ? %s THEN done ELSE done || %s END "
                "WHERE alert_id = %s RETURNING astronaut_id, done", (step, Jsonb([step]), alert_id)).fetchone()
        if row is None:
            raise KeyError(alert_id)
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

    def stats(self) -> dict:
        with self.pool.connection() as conn:
            counts = conn.execute(
                "SELECT count(*) FILTER (WHERE status = 'queued') AS queued, "
                "count(*) FILTER (WHERE status = 'delivered') AS delivered, "
                "count(DISTINCT brief_id) AS briefs FROM bundles").fetchone()
            readings = conn.execute("SELECT count(*) AS n FROM readings").fetchone()["n"]
        sample = self.history(self.settings.astronaut_id, limit=50)
        per_reading = pulsebrief.raw_size(sample) / len(sample) if sample else 0
        return {**counts, "bytes_sent": medlink.link(self.pool)["bytes_sent"], "readings": readings,
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
