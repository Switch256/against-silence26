"""The whole demo story through the HTTP API, on the test database."""
import os

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client(pool):           # `pool` runs the migrations on the test database
    app.state.database_url = os.environ["TEST_DATABASE_URL"]
    with TestClient(app) as c:
        c.post("/api/reset")
        yield c


def test_health_and_proto_page(client):
    assert client.get("/api/health").json() == {"ok": True}
    assert "AEGIS-MEDLINK" in client.get("/proto/").text


def test_normal_readings_build_a_baseline_without_alerts(client):
    r = client.post("/api/sim/step", json={"scenario": "normal", "count": 40}).json()
    assert r["generated"] == 40 and r["alerts"] == []


def test_full_story_blackout_short_window_restore_reply(client):
    client.post("/api/sim/step", json={"scenario": "normal", "count": 40})
    client.post("/api/link", json={"state": "down"})

    spike = client.post("/api/sim/step", json={"scenario": "spike", "count": 30}).json()
    assert spike["alerts"], "the spike should raise at least one alert"
    alert = spike["alerts"][0]

    # astronaut acts while waiting; context (still queued) picks it up
    assert client.post("/api/checkin", json={"feeling": "a_bit_off", "symptom": "dizzy"}).json()["context_updated"]
    done = client.post(f"/api/alerts/{alert['alert_id']}/done", json={"step": "Drink water"}).json()
    assert done["done"] == ["Drink water"]

    ship = client.get("/api/spacecraft").json()
    assert ship["link"]["state"] == "down" and ship["eta"]["earliest_reply_in_min"] == 40
    assert all(b["status"] == "queued" for b in ship["outbox"])
    assert client.get("/api/earth").json()["briefs"] == []

    win = client.post("/api/link/window", json={"budget_bytes": 250}).json()
    assert [s.split(":")[1] for s in win["sent"]] == ["headline"]
    brief = client.get("/api/earth").json()["briefs"][0]
    assert set(brief["layers"]) == {"headline"}

    client.post("/api/link", json={"state": "up"})
    brief = client.get("/api/earth").json()["briefs"][0]
    assert set(brief["layers"]) == {"headline", "context", "evidence"}
    assert brief["layers"]["context"]["checkin"]["symptom"] == "dizzy"
    assert "Drink water" in brief["layers"]["context"]["done"]

    client.post("/api/earth/reply", json={"brief_id": brief["brief_id"], "text": "Rest 15 min, re-measure."})
    assert client.get("/api/spacecraft").json()["replies"][0]["text"] == "Rest 15 min, re-measure."

    stats = client.get("/api/stats").json()
    assert stats["queued"] == 0 and stats["bytes_sent"] < stats["raw_bytes_equivalent"]


def test_loose_watch_and_exercise_do_not_alert(client):
    client.post("/api/sim/step", json={"scenario": "normal", "count": 40})
    assert client.post("/api/sim/step", json={"scenario": "loose_watch", "count": 20}).json()["alerts"] == []
    assert client.post("/api/sim/step", json={"scenario": "exercise", "count": 20}).json()["alerts"] == []


def test_repeated_alerts_are_rate_limited(client):
    client.post("/api/sim/step", json={"scenario": "normal", "count": 40})
    alerts = client.post("/api/sim/step", json={"scenario": "spike", "count": 40}).json()["alerts"]
    # review first, then one escalation to urgent, not one alert per second
    assert 1 <= len(alerts) <= 3


def test_bad_input_is_rejected(client):
    assert client.post("/api/link", json={"state": "sideways"}).status_code == 422
    assert client.post("/api/readings", json={"ts": "2026-11-14T12:00:00Z", "heart_rate": -5}).status_code == 422
    assert client.post("/api/alerts/nope/done", json={"step": "x"}).status_code == 404
