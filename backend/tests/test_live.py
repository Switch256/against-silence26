"""Live telemetry: a simulated reading every interval, scenarios held then back to normal."""
import os
import time
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

from app import mission as mission_mod
from app.main import app


def test_live_stream_ingests_readings_and_holds_scenarios(pool, monkeypatch):
    monkeypatch.setenv("LIVE_SIM", "1")
    app.state.database_url = os.environ["TEST_DATABASE_URL"]
    with TestClient(app) as c:
        c.post("/api/reset")
        live = app.state.mission.live
        live.interval_s = 0.05                                   # fast ticks after the current 1 s wait
        time.sleep(1.8)
        n = len(c.get("/api/spacecraft").json()["readings"])
        assert n >= 5 and c.get("/api/sim/live").json()["running"] is True

        # a demo burst switches the stream to that scenario, then it returns to normal
        monkeypatch.setattr(mission_mod, "SCENARIO_HOLD", timedelta(seconds=0.3))
        c.post("/api/sim/step", json={"scenario": "exercise", "count": 1})
        assert c.get("/api/sim/live").json()["scenario"] == "exercise"
        time.sleep(0.6)
        assert c.get("/api/sim/live").json()["scenario"] == "normal"

        # pause stops new readings
        c.post("/api/sim/live", json={"running": False})
        time.sleep(0.15)
        before = c.get("/api/stats").json()["readings"]
        time.sleep(0.4)
        assert c.get("/api/stats").json()["readings"] == before
        c.post("/api/sim/live", json={"running": True})


def test_live_readings_follow_the_wall_clock(pool, monkeypatch):
    monkeypatch.setenv("LIVE_SIM", "1")
    app.state.database_url = os.environ["TEST_DATABASE_URL"]
    with TestClient(app) as c:
        c.post("/api/reset")
        app.state.mission.live.running.clear()
        r = app.state.mission.next_live_reading("normal")
        assert abs((r.ts - datetime.now(timezone.utc)).total_seconds()) < 5 and r.source == "simulator"


def test_live_control_without_stream_is_rejected(pool):
    app.state.database_url = os.environ["TEST_DATABASE_URL"]
    with TestClient(app) as c:
        assert c.post("/api/sim/live", json={"running": False}).status_code == 409
