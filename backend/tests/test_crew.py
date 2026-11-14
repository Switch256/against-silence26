"""Crew record: fictional roster, measurement history, CSV / JSON export."""
import os

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client(pool):
    app.state.database_url = os.environ["TEST_DATABASE_URL"]
    with TestClient(app) as c:
        c.post("/api/reset")
        yield c


def test_roster_is_fictional_and_has_flags(client):
    body = client.get("/api/crew").json()
    assert body["profile"]["astronaut_id"] == "crew-01" and body["profile"]["monitored"]
    assert [m["country_code"] for m in body["crew"]] == ["TR", "UG", "US"]
    for m in body["crew"]:
        assert m["fictional"] and len(m["country_code"]) == 2 and m["age"] > 0


def test_history_raw_and_bucketed(client):
    client.post("/api/sim/step", json={"scenario": "normal", "count": 90})
    client.post("/api/sim/step", json={"scenario": "spike", "count": 1, "force": True})
    raw = client.get("/api/crew/history", params={"limit": 50}).json()
    total = raw["total_readings"]
    assert total >= 91 and len(raw["readings"]) == 50 and raw["next_before"]
    assert raw["readings"][0]["ts"] >= raw["readings"][-1]["ts"]          # newest first
    assert raw["alerts"] and raw["alerts"][0]["metric"] == "heart_rate"
    page2 = client.get("/api/crew/history", params={"limit": 50, "before": raw["next_before"]}).json()
    assert len(page2["readings"]) == total - 50
    agg = client.get("/api/crew/history", params={"step_s": 60}).json()
    assert sum(r["samples"] for r in agg["readings"]) == total


def test_exports(client):
    client.post("/api/sim/step", json={"scenario": "normal", "count": 5})
    r = client.get("/api/crew/export", params={"dataset": "readings", "format": "csv"})
    assert r.headers["content-type"].startswith("text/csv") and "attachment" in r.headers["content-disposition"]
    lines = r.text.strip().splitlines()
    assert lines[0].startswith("#") and lines[1].startswith("astronaut_id,ts,heart_rate") and len(lines) == 7
    j = client.get("/api/crew/export", params={"dataset": "all", "format": "json"}).json()
    assert len(j["readings"]) == 5 and "alerts" in j and j["profile"]["fictional"]
    assert client.get("/api/crew/export", params={"dataset": "all", "format": "csv"}).status_code == 422
