"""Forced demo alerts, real hand-off/arrival times, the explicit short-window state, ids in events."""
import os
import time

import pytest
from fastapi.testclient import TestClient

from app import medlink
from app.main import app


@pytest.fixture
def client(pool):
    app.state.database_url = os.environ["TEST_DATABASE_URL"]
    with TestClient(app) as c:
        c.post("/api/reset")
        c.post("/api/sim/step", json={"scenario": "normal", "count": 40})
        yield c


def test_force_guarantees_an_alert_even_during_cooldown(client):
    first = client.post("/api/sim/step", json={"scenario": "spike", "count": 30}).json()["alerts"]
    assert first
    again = client.post("/api/sim/step", json={"scenario": "spike", "count": 5}).json()["alerts"]
    assert again == []                                   # cooldown would normally hide it
    forced = client.post("/api/sim/step", json={"scenario": "spike", "count": 5, "force": True}).json()
    assert len(forced["alerts"]) == 1 and forced["alerts"][0]["severity"] == "urgent"
    assert forced["last_reading"]["source"] == "simulator"


def test_force_low_oxygen_triggers_spo2_alert(client):
    forced = client.post("/api/sim/step", json={"scenario": "low_oxygen", "count": 1, "force": True}).json()
    assert forced["alerts"][0]["metric"] == "spo2"


def test_outbox_reports_hand_off_and_arrival_times(client):
    client.post("/api/sim/step", json={"scenario": "spike", "count": 30})
    outbox = client.get("/api/spacecraft").json()["outbox"]
    assert outbox and all(b["sent_at"] and b["delivered_at"] for b in outbox)
    assert all(b["sent_at"] <= b["delivered_at"] for b in outbox)


def test_short_window_is_an_explicit_state_that_expires(client):
    client.post("/api/link", json={"state": "down"})
    client.post("/api/sim/step", json={"scenario": "spike", "count": 30})
    win = client.post("/api/link/window", json={"budget_bytes": 250, "duration_s": 1}).json()
    assert win["link"]["state"] == "window" and win["link"]["window_until"]
    queued_before = sum(b["status"] == "queued" for b in client.get("/api/spacecraft").json()["outbox"])
    client.post("/api/sim/step", json={"scenario": "spike", "count": 3, "force": True})   # new brief during the window
    queued_after = sum(b["status"] == "queued" for b in client.get("/api/spacecraft").json()["outbox"])
    assert queued_after == queued_before + 3             # the window's budget is spent: nothing extra leaves
    time.sleep(1.3)
    assert client.get("/api/mission").json()["link"]["state"] == "down"


def test_restoring_the_link_ends_a_window(client):
    client.post("/api/link", json={"state": "down"})
    client.post("/api/link/window", json={"budget_bytes": 250, "duration_s": 30})
    client.post("/api/link", json={"state": "up"})
    assert client.get("/api/mission").json()["link"] == {"state": "up", "window_until": None}


def test_events_carry_brief_and_reply_ids(client):
    alert = client.post("/api/sim/step", json={"scenario": "spike", "count": 30}).json()["alerts"][0]
    brief_id = alert["alert_id"].replace("al-", "pb-", 1)
    client.post("/api/earth/reply", json={"brief_id": brief_id, "text": "Rest and re-measure."})
    events = client.get("/api/events").json()
    by_kind = {}
    for e in events:
        by_kind.setdefault(e["kind"], []).append(e["data"])
    assert by_kind["alert"][0]["brief_id"] == brief_id
    assert all(d["brief_id"] == brief_id for d in by_kind["bundle_sent"] + by_kind["bundle_delivered"]
               if d["bundle_id"].startswith(brief_id))
    assert by_kind["reply_queued"][0]["brief_id"] == brief_id and by_kind["reply_queued"][0]["reply_id"]
    assert by_kind["reply_delivered"][0]["reply_id"] == by_kind["reply_queued"][0]["reply_id"]
