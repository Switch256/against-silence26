"""AEGIS-MEDLINK backend. Run: python run.py  (from backend/; serves on port 8001)

API docs: /docs   ·   Prototype test page: /proto/
"""
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, HTTPException, Query
from fastapi.encoders import jsonable_encoder
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from . import crew, db, events, medlink
from .config import get_settings
from .mission import Mission
from .models import CheckIn, Reading
from .simulator import SCENARIOS


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings(getattr(app.state, "database_url", None))
    pool = db.open_pool(settings.database_url)
    app.state.mission = Mission(pool, settings)
    app.state.mission.start()
    yield
    app.state.mission.stop()
    pool.close()


app = FastAPI(title="AEGIS-MEDLINK", version="0.1.0", lifespan=lifespan,
              description="Onboard health check (AEGIS) and delay-tolerant medical link (MEDLINK).")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:3000", "http://127.0.0.1:3000",
                                                  "http://localhost:3001", "http://127.0.0.1:3001"],
                   allow_methods=["*"], allow_headers=["*"])
app.mount("/proto", StaticFiles(directory=Path(__file__).parent / "static" / "proto", html=True), name="proto")


def mission() -> Mission:
    return app.state.mission


class SimStep(BaseModel):
    scenario: Literal[SCENARIOS] = "normal"          # type: ignore[valid-type]
    count: int = Field(default=1, ge=1, le=600)
    force: bool = Field(default=False, description="guarantee an alert even if cooldown/baseline would suppress it")


class LinkChange(BaseModel):
    state: Literal["up", "down"]


class Window(BaseModel):
    budget_bytes: int = Field(default=250, ge=1, le=100_000)
    duration_s: float = Field(default=8, ge=1, le=60, description="how long the link shows 'window' before dropping")


class DoneStep(BaseModel):
    step: str


class ReplyIn(BaseModel):
    brief_id: str
    text: str = Field(min_length=1, max_length=500)


@app.get("/", include_in_schema=False)
def root():
    return RedirectResponse("/proto/")


@app.get("/api/health", tags=["system"])
def health():
    return {"ok": True}


# ---- spacecraft ----

@app.post("/api/readings", tags=["spacecraft"])
def post_reading(reading: Reading):
    """Ingest one reading (simulator, NASA scenario or wearable). Returns any alert raised."""
    return mission().ingest(reading)


@app.post("/api/sim/step", tags=["spacecraft"])
def sim_step(body: SimStep):
    """Generate simulated readings and ingest them. 'spike' raises an alert; force=true guarantees one."""
    results = mission().simulate(body.scenario, body.count, body.force)
    alerts = [r["alert"] for r in results if r["alert"]]
    return {"generated": len(results), "alerts": alerts, "last_reading": results[-1]["reading"]}


@app.post("/api/checkin", tags=["spacecraft"])
def post_checkin(c: CheckIn):
    """3-tap check-in: fine / a_bit_off / unwell, plus an optional symptom."""
    return mission().checkin(c)


@app.post("/api/alerts/{alert_id}/done", tags=["spacecraft"])
def post_done(alert_id: str, body: DoneStep):
    """Tick off a 'what to do now' step."""
    try:
        return mission().mark_done(alert_id, body.step)
    except KeyError:
        raise HTTPException(404, "alert not found")


@app.get("/api/spacecraft", tags=["spacecraft"])
def spacecraft(readings: int = 120):
    """Everything the astronaut dashboard shows, in one call (poll every 1-2 s)."""
    m = mission()
    aid = m.settings.astronaut_id
    alerts = m.alerts(aid)
    return {
        "astronaut_id": aid,
        "readings": m.history(aid, limit=readings),
        "latest_alert": alerts[0] if alerts else None,
        "alerts": alerts,
        "checkin": m.latest_checkin(aid),
        "outbox": medlink.outbox(m.pool),
        "link": medlink.link(m.pool),
        "eta": m.eta(),
        "replies": medlink.replies(m.pool, "delivered"),
        "transport": m.settings.transport,
    }


# ---- the link ----

@app.post("/api/link", tags=["link"])
def set_link(body: LinkChange):
    """Cut ('down') or restore ('up') the space link. Restoring flushes the outbox."""
    m = mission()
    return {"sent": m.set_link(body.state), "link": medlink.link(m.pool)}


@app.post("/api/link/window", tags=["link"])
def link_window(body: Window):
    """A short contact: send what fits in budget_bytes; link shows 'window' for duration_s, then drops."""
    m = mission()
    return {"sent": m.open_window(body.budget_bytes, body.duration_s), "link": medlink.link(m.pool)}


# ---- Earth ----

@app.get("/api/earth", tags=["earth"])
def earth():
    """Everything the Earth console shows: received briefs (any layers so far) and replies."""
    m = mission()
    return {"briefs": medlink.earth_briefs(m.pool), "replies": medlink.replies(m.pool)}


@app.post("/api/earth/reply", tags=["earth"])
def earth_reply(body: ReplyIn):
    """Doctor's reply. Delivered to the spacecraft when the link is up."""
    return {"reply_id": mission().reply(body.brief_id, body.text)}


# ---- mission (3D simulation) ----

@app.get("/api/mission", tags=["mission"])
def mission_overview():
    """Spacecraft, link, ground station, BPv7 node counters and the latest 40 events (newest first)."""
    return mission().overview()


@app.get("/api/events", tags=["mission"])
def list_events(since_id: int = 0):
    """Events with id > since_id, oldest first. Poll with the last id you saw."""
    return events.since(mission().pool, since_id)


# ---- system ----

class LiveControl(BaseModel):
    running: bool | None = None
    scenario: Literal[SCENARIOS] | None = None       # type: ignore[valid-type]


@app.get("/api/sim/live", tags=["spacecraft"])
def live_state():
    """Live telemetry stream: one simulated reading per second (LIVE_SIM=1)."""
    m = mission()
    return m.live.state() if m.live else {"running": False, "scenario": None, "until": None, "interval_s": None}


@app.post("/api/sim/live", tags=["spacecraft"])
def live_control(body: LiveControl):
    """Pause/resume the live stream, or switch the scenario it streams (held for 45 s, then normal)."""
    m = mission()
    if not m.live:
        raise HTTPException(409, "live telemetry is off (set LIVE_SIM=1 in backend/.env)")
    if body.running is not None:
        (m.live.running.set if body.running else m.live.running.clear)()
    if body.scenario:
        m.live.hold(body.scenario)
    return m.live.state()


class Escalation(BaseModel):
    reason: Literal["no_response", "crew_request"]


@app.post("/api/escalate", tags=["spacecraft"])
def escalate(body: Escalation):
    """Emergency check result: crew asked for Earth, or did not answer. Sends an urgent PulseBrief at once."""
    return mission().escalate(body.reason)


class Replay(BaseModel):
    scenario: Literal["may-2024", "live"]


@app.get("/api/space-weather", tags=["space weather"])
def space_weather():
    """Crew space-weather environment from NASA DONKI: level, headline, active and recent events."""
    return mission().space_weather()


@app.post("/api/space-weather/refresh", tags=["space weather"])
def space_weather_refresh():
    """Fetch the last 30 days from NASA DONKI (needs network; NASA_API_KEY raises the rate limit)."""
    return mission().refresh_space_weather()


@app.post("/api/space-weather/replay", tags=["space weather"])
def space_weather_replay(body: Replay):
    """Replay a real past DONKI event as if it were happening now (raises an AEGIS alert), or go back to live."""
    return mission().replay_space_weather(body.scenario)


# ---- crew record: profile, measurement history, export ----

@app.get("/api/crew", tags=["crew record"])
def crew_record(astronaut_id: str | None = None):
    """The astronaut's (simulated) profile, personal baselines and what the record holds."""
    m = mission()
    return crew.summary(m.pool, astronaut_id or m.settings.astronaut_id)


@app.get("/api/crew/history", tags=["crew record"])
def crew_history(start: datetime | None = None, end: datetime | None = None,
                 step_s: int = Query(0, ge=0, le=86_400, description="0 = every reading; >0 = averages per bucket of this many seconds"),
                 limit: int = Query(500, ge=1, le=5000), before: datetime | None = Query(None, description="page: rows older than this"),
                 astronaut_id: str | None = None):
    """Measurements at each time (newest first) with the alerts and check-ins in the same range."""
    m = mission()
    return crew.history(m.pool, astronaut_id or m.settings.astronaut_id, start, end, step_s, limit, before)


@app.get("/api/crew/export", tags=["crew record"])
def crew_export(dataset: Literal["readings", "alerts", "checkins", "all"] = "readings",
                format: Literal["csv", "json"] = "csv",
                start: datetime | None = None, end: datetime | None = None, astronaut_id: str | None = None):
    """Download the historical record. CSV per dataset; JSON can bundle all three with the profile."""
    m = mission()
    aid = astronaut_id or m.settings.astronaut_id
    stamp = datetime.now().strftime("%Y%m%d-%H%M")
    if format == "csv":
        if dataset == "all":
            raise HTTPException(422, "CSV exports one dataset at a time; use format=json for all")
        cols, rows = crew.rows_for(m.pool, dataset, aid, start, end)
        return Response(crew.to_csv(cols, rows, aid), media_type="text/csv",
                        headers={"Content-Disposition": f'attachment; filename="aegis-{aid}-{dataset}-{stamp}.csv"'})
    sets = crew.DATASETS if dataset == "all" else (dataset,)
    body = {"exported_at": datetime.now().astimezone(), "note": "SIMULATED data from the AEGIS-MEDLINK demo; not a medical device",
            "profile": crew.profile(aid), "start": start, "end": end}
    for d in sets:
        body[d] = crew.rows_for(m.pool, d, aid, start, end)[1]
    return JSONResponse(jsonable_encoder(body),
                        headers={"Content-Disposition": f'attachment; filename="aegis-{aid}-{dataset}-{stamp}.json"'})


@app.get("/api/stats", tags=["system"])
def stats():
    """Bytes sent over the link vs. the raw readings, queue counts."""
    return mission().stats()


@app.post("/api/reset", tags=["system"])
def reset():
    """Empty all tables for a fresh demo run."""
    db.reset(mission().pool)
    mission().space_weather_as_of = None            # NASA DONKI data itself is kept across resets
    return {"ok": True}
