"""Ties the parts together: ingest a reading -> AEGIS -> PulseBrief -> MEDLINK."""
import logging
import threading
import uuid
from datetime import datetime, timedelta, timezone

from psycopg.types.json import Jsonb
from psycopg_pool import ConnectionPool

from . import aegis, donki, dtn, events, medlink, pulsebrief
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
METRIC_LABEL = {"heart_rate": ("Heart rate", " bpm"), "spo2": ("SpO2", "%"), "space_weather": ("Space weather", "")}
# Real NASA DONKI events that can be replayed on stage: the start of the May 2024 solar storm.
REPLAYS = {"may-2024": datetime(2024, 5, 9, 14, 30, tzinfo=timezone.utc)}
SCENARIO_HOLD = timedelta(seconds=45)    # a demo scenario keeps streaming this long, then back to normal


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
        self.space_weather_as_of: datetime | None = None     # set while replaying a real past event
        self._sim_lock = threading.Lock()                      # the live stream and the API share the simulator
        self.live = LiveTelemetry(self) if settings.live_sim else None
        if settings.transport == "dtn":
            self.transport = dtn.DtnTransport(settings.dtn_spacecraft_url, settings.dtn_earth_url)
            self.link_ctl = dtn.DockerLink(settings.dtn_network, settings.dtn_earth_container, settings.dtn_earth_ip)
            self.receiver = dtn.Receiver(pool, self.transport)
        else:
            self.transport = medlink.EarthInbox(pool)

    def start(self) -> None:
        if self.live:
            self.live.start()
        with self.pool.connection() as conn:
            empty = conn.execute("SELECT NOT EXISTS (SELECT 1 FROM space_weather) AS e").fetchone()["e"]
        if empty:
            donki.load_snapshot(self.pool)                  # real NASA data even without network
        if self.receiver:
            self.link_ctl.set(medlink.link(self.pool)["state"] == "up")
            self.receiver.start()

    def stop(self) -> None:
        if self.live:
            self.live.stop()
        if self.receiver:
            self.receiver.stop()

    # ---- the space link ----

    def set_link(self, state: str) -> list[str]:
        if self.link_ctl:
            self.link_ctl.set(state == "up")
        return medlink.set_link(self.pool, self.transport, state)

    def open_window(self, budget_bytes: int, duration_s: float = 8) -> list[str]:
        """Open the link briefly: release what fits, wait for it to arrive, then cut the link again."""
        if self.link_ctl:
            self.link_ctl.set(True)
        sent = medlink.open_window(self.pool, self.transport, budget_bytes, duration_s)
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

    def simulate(self, scenario: str, count: int, force: bool = False) -> list[dict]:
        """Generate and ingest simulated readings. force: guarantee an alert for this batch.
        With the live stream on, it then keeps streaming this scenario for SCENARIO_HOLD."""
        with self._sim_lock:
            readings = [self.sim.next(scenario) for _ in range(count)]
            trigger = self.sim.trigger(scenario) if force else None
        results = [self.ingest(r) for r in readings]
        if trigger and not any(r["alert"] for r in results):
            results.append(self.ingest(trigger, force=True))
        if self.live:
            self.live.hold(scenario)
        return results

    def next_live_reading(self, scenario: str) -> Reading:
        with self._sim_lock:
            # live readings follow the wall clock (a burst may have pushed the sim clock ahead)
            self.sim.clock = max(self.sim.clock, datetime.now(timezone.utc).replace(microsecond=0) - timedelta(seconds=1))
            return self.sim.next(scenario)

    def ingest(self, reading: Reading, force: bool = False) -> dict:
        """force skips the repeat-alert cooldown (used by the demo's guaranteed trigger)."""
        history = self.history(reading.astronaut_id)
        self._store_reading(reading)
        alert = aegis.evaluate(reading, history)
        if alert is None or (not force and self._cooling_down(alert)):
            return {"reading": reading, "alert": None, "brief_id": None}
        self._store_alert(alert)
        label, unit = METRIC_LABEL.get(alert.metric, (alert.metric, ""))
        events.log(self.pool, "alert", f"{label} alert: {alert.value:g}{unit} ({alert.severity.value})",
                   alert_id=alert.alert_id, brief_id=alert.alert_id.replace("al-", "pb-", 1),
                   metric=alert.metric, value=alert.value, severity=alert.severity.value)
        brief_id = self._send_brief(alert, history + [reading])
        return {"reading": reading, "alert": alert, "brief_id": brief_id}

    def _send_brief(self, alert: Alert, history: list[Reading]) -> str:
        layers = pulsebrief.build(alert, history, self.latest_checkin(alert.astronaut_id),
                                  environment=self.environment_summary())
        brief_id = medlink.enqueue(self.pool, layers, alert.severity)
        size = sum(len(l.encode()) for l in layers)
        events.log(self.pool, "brief_queued", f"PulseBrief queued ({len(layers)} layers, {size} B)",
                   brief_id=brief_id, severity=alert.severity.value, size=size)
        medlink.flush(self.pool, self.transport)
        return brief_id

    # ---- space weather (NASA DONKI) ----

    def space_weather(self) -> dict:
        as_of = self.space_weather_as_of or datetime.now(timezone.utc)
        return {**donki.status(self.pool, as_of), "mode": "replay" if self.space_weather_as_of else "live",
                "recent": donki.recent(self.pool, as_of)}

    def environment_summary(self) -> dict:
        s = donki.status(self.pool, self.space_weather_as_of or datetime.now(timezone.utc))
        return {"level": s["level"], "headline": s["headline"], "source": s["source"],
                "mode": "replay" if self.space_weather_as_of else "live"}

    def refresh_space_weather(self) -> dict:
        result = donki.refresh(self.pool, self.settings.nasa_api_key)
        events.log(self.pool, "space_weather_refresh",
                   f"NASA DONKI refreshed: {result['new']} new event(s)" +
                   (f", errors: {', '.join(result['errors'])}" if result["errors"] else ""), **result)
        return result

    def replay_space_weather(self, scenario: str) -> dict:
        """Replay a real past DONKI event as if it were happening now ('live' ends the replay)."""
        if scenario == "live":
            self.space_weather_as_of = None
            events.log(self.pool, "space_weather", "Space weather back to live NASA DONKI data")
            return {"mode": "live", "alert": None}
        self.space_weather_as_of = REPLAYS[scenario]
        status = donki.status(self.pool, self.space_weather_as_of)
        events.log(self.pool, "space_weather", f"Replaying NASA DONKI: {status['headline']}",
                   scenario=scenario, level=status["level"], events=[e["event_id"] for e in status["active"]])
        alert = self._environment_alert(status)
        if alert:
            self._store_alert(alert)
            events.log(self.pool, "alert", f"Space weather alert ({alert.severity.value})",
                       alert_id=alert.alert_id, brief_id=alert.alert_id.replace("al-", "pb-", 1),
                       metric=alert.metric, value=alert.value, severity=alert.severity.value)
            self._send_brief(alert, self.history(self.settings.astronaut_id))
        return {"mode": "replay", "status": status, "alert": alert}

    def _environment_alert(self, status: dict) -> Alert | None:
        if status["level"] != "warning":
            return None
        seps = [e for e in status["active"] if e["kind"] == "SEP"]
        first = min(e["start_time"] for e in seps).astimezone(timezone.utc)
        latest = self.history(self.settings.astronaut_id, limit=1)
        return Alert(alert_id=f"al-{uuid.uuid4().hex[:10]}", astronaut_id=self.settings.astronaut_id,
                     ts=datetime.now(timezone.utc), metric="space_weather", value=float(len(seps)), baseline=None,
                     deviation=None, severity="urgent",
                     reason=f"NASA DONKI reports {len(seps)} solar energetic particle event(s) since "
                            f"{first:%d %b %Y %H:%M} UTC. Radiation risk is elevated (environment, not a measured dose).",
                     activity=latest[0].activity if latest else "rest",
                     signal_quality=latest[0].signal_quality if latest else "good", todo=donki.SEP_TODO)

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
            "link": {k: v for k, v in medlink.link(self.pool).items() if k in ("state", "window_until")},
            "ground_station": ground_station(),
            "bpv7": self.transport.status() if self.settings.transport == "dtn" else None,
            "space_weather": self.environment_summary(),
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
                                  row.get("done") or [], environment=self.environment_summary())
        context = next(l for l in layers if l.layer == Layer.context)
        return medlink.update_layer(self.pool, context.payload["id"], context)


class LiveTelemetry(threading.Thread):
    """Streams one simulated reading per second through AEGIS, like continuous telemetry from orbit.

    Readings are labelled source="simulator". A demo scenario (spike, low oxygen, ...) streams for
    SCENARIO_HOLD and then returns to normal; pause() / resume() control the stream.
    """

    def __init__(self, mission: "Mission", interval_s: float = 1.0):
        super().__init__(daemon=True, name="live-telemetry")
        self.mission, self.interval_s = mission, interval_s
        self.scenario, self.until = "normal", None
        self.running = threading.Event()
        self.running.set()
        self.stopping = threading.Event()

    def hold(self, scenario: str) -> None:
        self.scenario = scenario
        self.until = None if scenario == "normal" else datetime.now(timezone.utc) + SCENARIO_HOLD

    def state(self) -> dict:
        return {"running": self.running.is_set(), "scenario": self.scenario, "until": self.until,
                "interval_s": self.interval_s}

    def run(self) -> None:
        while not self.stopping.is_set():
            if self.running.is_set():
                if self.until and datetime.now(timezone.utc) >= self.until:
                    self.hold("normal")
                try:
                    self.mission.ingest(self.mission.next_live_reading(self.scenario))
                except Exception:                      # keep streaming; one bad tick must not stop telemetry
                    logging.getLogger("aegis.live").exception("live telemetry tick failed")
            self.stopping.wait(self.interval_s)

    def stop(self) -> None:
        self.stopping.set()
