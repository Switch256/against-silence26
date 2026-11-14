"""AEGIS-MEDLINK backend. Run: python run.py  (from backend/; serves on port 8001)

API docs: /docs   ·   Prototype test page: /proto/
"""
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from . import db, medlink
from .config import get_settings
from .mission import Mission
from .models import CheckIn, Reading
from .simulator import SCENARIOS


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings(getattr(app.state, "database_url", None))
    pool = db.open_pool(settings.database_url)
    app.state.mission = Mission(pool, settings)
    yield
    pool.close()


app = FastAPI(title="AEGIS-MEDLINK", version="0.1.0", lifespan=lifespan,
              description="Onboard health check (AEGIS) and delay-tolerant medical link (MEDLINK).")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
                   allow_methods=["*"], allow_headers=["*"])
app.mount("/proto", StaticFiles(directory=Path(__file__).parent / "static" / "proto", html=True), name="proto")


def mission() -> Mission:
    return app.state.mission


class SimStep(BaseModel):
    scenario: Literal[SCENARIOS] = "normal"          # type: ignore[valid-type]
    count: int = Field(default=1, ge=1, le=600)


class LinkChange(BaseModel):
    state: Literal["up", "down"]


class Window(BaseModel):
    budget_bytes: int = Field(default=250, ge=1, le=100_000)


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
    """Generate simulated readings and ingest them. Use scenario 'spike' to trigger an alert."""
    m = mission()
    results = [m.ingest(m.sim.next(body.scenario)) for _ in range(body.count)]
    alerts = [r["alert"] for r in results if r["alert"]]
    return {"generated": body.count, "alerts": alerts, "last_reading": results[-1]["reading"]}


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
    }


# ---- the link ----

@app.post("/api/link", tags=["link"])
def set_link(body: LinkChange):
    """Cut ('down') or restore ('up') the space link. Restoring flushes the outbox."""
    m = mission()
    return {"sent": medlink.set_link(m.pool, m.earth, body.state), "link": medlink.link(m.pool)}


@app.post("/api/link/window", tags=["link"])
def link_window(body: Window):
    """A short contact: send what fits in budget_bytes, then the link drops again."""
    m = mission()
    return {"sent": medlink.open_window(m.pool, m.earth, body.budget_bytes), "link": medlink.link(m.pool)}


# ---- Earth ----

@app.get("/api/earth", tags=["earth"])
def earth():
    """Everything the Earth console shows: received briefs (any layers so far) and replies."""
    m = mission()
    return {"briefs": medlink.earth_briefs(m.pool), "replies": medlink.replies(m.pool)}


@app.post("/api/earth/reply", tags=["earth"])
def earth_reply(body: ReplyIn):
    """Doctor's reply. Delivered to the spacecraft when the link is up."""
    m = mission()
    return {"reply_id": medlink.reply(m.pool, m.earth, body.brief_id, body.text)}


# ---- system ----

@app.get("/api/stats", tags=["system"])
def stats():
    """Bytes sent over the link vs. the raw readings, queue counts."""
    return mission().stats()


@app.post("/api/reset", tags=["system"])
def reset():
    """Empty all tables for a fresh demo run."""
    db.reset(mission().pool)
    return {"ok": True}
