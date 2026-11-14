"""NASA DONKI space weather: parsing real responses, environment status, replay through AEGIS, live refresh."""
import json
import os
from datetime import datetime, timezone

import httpx
import pytest
from fastapi.testclient import TestClient

from app import donki
from app.main import app

MAY_2024 = datetime(2024, 5, 9, 14, 30, tzinfo=timezone.utc)
SNAPSHOT_TOTAL = 86 + 1 + 5 + 14           # CME + GST + RBE + SEP files in backend/data/donki


@pytest.fixture
def sw(pool):
    with pool.connection() as conn:
        conn.execute("TRUNCATE space_weather")
    donki.load_snapshot(pool)
    return pool


def test_every_real_snapshot_record_normalizes():
    for path in donki.SNAPSHOT_DIR.glob("*.json"):
        kind = path.name.split("_")[0]
        for item in json.loads(path.read_text()):
            e = donki.normalize(kind, item)
            assert e["event_id"] and e["start_time"].tzinfo and e["severity"] in ("info", "caution", "warning")


def test_snapshot_loads_once(pool):
    with pool.connection() as conn:
        conn.execute("TRUNCATE space_weather")
    assert donki.load_snapshot(pool) == SNAPSHOT_TOTAL
    assert donki.load_snapshot(pool) == 0                 # idempotent


def test_may_2024_is_a_solar_particle_warning(sw):
    s = donki.status(sw, MAY_2024)
    assert s["level"] == "warning" and "radiation risk" in s["headline"]
    assert {e["kind"] for e in s["active"]} >= {"SEP"} and s["todo"] == donki.SEP_TODO
    assert s["source"] == "NASA DONKI" and "not a measured crew dose" in s["note"]


def test_quiet_time_is_nominal(sw):
    assert donki.status(sw, datetime(2025, 1, 15, tzinfo=timezone.utc))["level"] == "nominal"


def test_refresh_stores_live_events_and_reports_errors(sw):
    sep = json.loads((donki.SNAPSHOT_DIR / "SEP_2024-05-08_2024-05-20.json").read_text())[:2]

    def handler(request: httpx.Request) -> httpx.Response:
        kind = request.url.path.rsplit("/", 1)[-1]
        if kind == "GST":
            return httpx.Response(429)
        return httpx.Response(200, json=[{**s, "sepID": s["sepID"] + "-LIVE"} for s in sep] if kind == "SEP" else [])

    result = donki.refresh(sw, "TEST_KEY", client=httpx.Client(transport=httpx.MockTransport(handler)))
    assert result["new"] == 2 and result["fetched"]["SEP"] == 2
    assert "rate limit" in result["errors"]["GST"]


@pytest.fixture
def client(sw):
    app.state.database_url = os.environ["TEST_DATABASE_URL"]
    with TestClient(app) as c:
        c.post("/api/reset")
        c.post("/api/sim/step", json={"scenario": "normal", "count": 40})
        yield c


def test_replay_raises_an_aegis_alert_that_travels_as_a_pulsebrief(client):
    r = client.post("/api/space-weather/replay", json={"scenario": "may-2024"}).json()
    assert r["mode"] == "replay" and r["alert"]["metric"] == "space_weather" and r["alert"]["severity"] == "urgent"
    assert "NASA DONKI" in r["alert"]["reason"] and "09 May 2024 13:59 UTC" in r["alert"]["reason"]
    brief = client.get("/api/earth").json()["briefs"][0]
    assert brief["layers"]["headline"]["m"] == "space_weather"
    assert brief["layers"]["context"]["space_weather"]["level"] == "warning"
    sw = client.get("/api/space-weather").json()
    assert sw["mode"] == "replay" and sw["recent"]
    assert client.get("/api/mission").json()["space_weather"]["level"] == "warning"


def test_health_briefs_carry_the_space_weather_context(client):
    client.post("/api/space-weather/replay", json={"scenario": "may-2024"})
    client.post("/api/sim/step", json={"scenario": "spike", "count": 5, "force": True})
    briefs = client.get("/api/earth").json()["briefs"]
    hr = next(b for b in briefs if b["layers"]["headline"]["m"] == "heart_rate")
    assert hr["layers"]["context"]["space_weather"]["headline"].startswith("Solar particle event")


def test_back_to_live_and_reset_end_the_replay(client):
    client.post("/api/space-weather/replay", json={"scenario": "may-2024"})
    assert client.post("/api/space-weather/replay", json={"scenario": "live"}).json()["mode"] == "live"
    client.post("/api/space-weather/replay", json={"scenario": "may-2024"})
    client.post("/api/reset")
    assert client.get("/api/space-weather").json()["mode"] == "live"
