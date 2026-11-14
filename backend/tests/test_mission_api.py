"""Mission events log and the /api/mission overview (local transport)."""
import os
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.mission import ground_station


@pytest.fixture
def client(pool):
    app.state.database_url = os.environ["TEST_DATABASE_URL"]
    with TestClient(app) as c:
        c.post("/api/reset")
        yield c


def kinds(c, since_id=0):
    return [e["kind"] for e in c.get("/api/events", params={"since_id": since_id}).json()]


def run_story(c):
    c.post("/api/sim/step", json={"scenario": "normal", "count": 40})
    c.post("/api/link", json={"state": "down"})
    alert = c.post("/api/sim/step", json={"scenario": "spike", "count": 30}).json()["alerts"][0]
    c.post("/api/checkin", json={"feeling": "a_bit_off", "symptom": "dizzy"})
    c.post(f"/api/alerts/{alert['alert_id']}/done", json={"step": "Drink water"})
    c.post("/api/link/window", json={"budget_bytes": 250})
    c.post("/api/link", json={"state": "up"})
    brief = c.get("/api/earth").json()["briefs"][0]
    c.post("/api/earth/reply", json={"brief_id": brief["brief_id"], "text": "Rest 15 min."})


def test_empty_mission(client):
    m = client.get("/api/mission").json()
    assert m["mission_time_s"] == 0 and m["events"] == [] and m["bpv7"] is None
    assert m["link"] == {"state": "up"}
    assert m["spacecraft"] == {"name": "AEGIS-1", "distance_km": round(14 * 60 * 299792.458),
                               "light_delay_s": 840.0, "phase": "Cruise to Mars"}
    assert m["ground_station"]["name"] in {"DSN Goldstone", "DSN Madrid", "DSN Canberra"}


def test_ground_station_shifts():
    at = lambda h: ground_station(datetime(2026, 11, 14, h, tzinfo=timezone.utc))["name"]
    assert [at(0), at(7), at(8), at(15), at(16), at(23)] == [
        "DSN Goldstone", "DSN Goldstone", "DSN Madrid", "DSN Madrid", "DSN Canberra", "DSN Canberra"]


def test_story_records_events_in_order(client):
    run_story(client)
    k = kinds(client)
    assert k[0] == "link_down" and k[-2:] == ["reply_queued", "reply_delivered"]
    for expected in ("alert", "brief_queued", "checkin", "step_done", "window", "link_up",
                     "bundle_sent", "bundle_delivered"):
        assert expected in k, expected
    assert k.index("alert") < k.index("brief_queued") < k.index("window") < k.index("link_up")
    # only the headline crossed in the window, the rest after the link came back
    assert k[k.index("window") - 1] == "bundle_delivered"
    assert k.count("bundle_sent") == k.count("bundle_delivered") == 3


def test_event_payloads(client):
    run_story(client)
    ev = client.get("/api/events").json()
    by_kind = {}
    for e in ev:
        by_kind.setdefault(e["kind"], e)
    assert by_kind["alert"]["data"]["severity"] in {"routine", "review", "urgent"}
    assert by_kind["alert"]["data"]["value"] > 0
    first_sent = by_kind["bundle_sent"]["data"]
    assert first_sent["layer"] == "headline" and first_sent["bundle_id"].endswith(":headline")
    assert by_kind["bundle_delivered"]["text"] == f"Headline crossed the link ({first_sent['size']} B)"
    win = by_kind["window"]["data"]
    assert win["budget_bytes"] == 250 and [s.split(":")[1] for s in win["sent"]] == ["headline"]
    assert by_kind["checkin"]["text"] == "Crew check-in: a bit off, dizzy"


def test_events_since_id_is_incremental(client):
    client.post("/api/link", json={"state": "down"})
    first = client.get("/api/events").json()
    assert [e["kind"] for e in first] == ["link_down"] and "id" in first[0]
    client.post("/api/link", json={"state": "up"})
    newer = client.get("/api/events", params={"since_id": first[-1]["id"]}).json()
    assert [e["kind"] for e in newer] == ["link_up"]
    assert client.get("/api/events", params={"since_id": newer[-1]["id"]}).json() == []


def test_mission_overview_after_story(client):
    run_story(client)
    m = client.get("/api/mission").json()
    assert m["mission_time_s"] >= 69                      # 70 simulated readings, one per second
    assert m["link"]["state"] == "up"
    assert m["events"][0]["kind"] == "reply_delivered"   # newest first
    assert set(m["events"][0]) == {"ts", "kind", "text", "data"}
    assert len(m["events"]) <= 40


def test_reset_clears_events(client):
    client.post("/api/link", json={"state": "down"})
    client.post("/api/reset")
    assert client.get("/api/events").json() == []


def test_cors_allows_simulation_origin(client):
    r = client.options("/api/mission", headers={"Origin": "http://localhost:3001",
                                                "Access-Control-Request-Method": "GET"})
    assert r.headers["access-control-allow-origin"] == "http://localhost:3001"
