"""End to end over real BPv7: two dtn7-rs nodes, link cut at the network level.

Needs: docker compose -f backend/dtn/docker-compose.yml up -d   (skipped otherwise)
"""
import os
import time

import httpx
import pytest
from fastapi.testclient import TestClient

from app.dtn import bundle_payload, is_bundle
from app.main import app

SPACECRAFT = os.environ.get("DTN_SPACECRAFT_URL", "http://127.0.0.1:3020")
EARTH = os.environ.get("DTN_EARTH_URL", "http://127.0.0.1:3021")


def nodes_up() -> bool:
    try:
        return all(httpx.get(f"{u}/status/info", timeout=2).status_code == 200 for u in (SPACECRAFT, EARTH))
    except httpx.HTTPError:
        return False


def dev_server_receiving() -> bool:
    """A running dev server (DTN mode) pulls bundles off the same nodes and would steal the test's bundles."""
    try:
        return httpx.get("http://127.0.0.1:8001/api/stats", timeout=1).json().get("transport") == "dtn"
    except (httpx.HTTPError, ValueError):
        return False


pytestmark = [
    pytest.mark.skipif(not nodes_up(), reason="dtn7 nodes not running"),
    pytest.mark.skipif(dev_server_receiving(),
                       reason='dev server on :8001 is using the BPv7 nodes; stop it (pkill -f "run.py") to run this test'),
]


def eventually(check, timeout=25):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if (value := check()):
            return value
        time.sleep(0.3)
    raise AssertionError("timed out waiting for BPv7 delivery")


@pytest.fixture
def client(pool, monkeypatch):
    monkeypatch.setenv("MEDLINK_TRANSPORT", "dtn")
    app.state.database_url = os.environ["TEST_DATABASE_URL"]
    for url, ep in ((EARTH, "medical"), (SPACECRAFT, "crew")):      # drain bundles left from earlier runs
        while is_bundle(httpx.get(f"{url}/endpoint?{ep}").content):
            pass
    with TestClient(app) as c:
        c.post("/api/reset")
        c.post("/api/link", json={"state": "up"})
        yield c
        c.post("/api/link", json={"state": "up"})                   # leave the network connected


def layers_at_earth(c):
    briefs = c.get("/api/earth").json()["briefs"]
    return {l for b in briefs for l in b["layers"]}


def test_bundle_decoder_reads_real_bpv7():
    httpx.post(f"{SPACECRAFT}/send", params={"dst": "dtn://earth/medical", "lifetime": 60}, content=b'{"t":1}')
    raw = eventually(lambda: (r := httpx.get(f"{EARTH}/endpoint?medical")) and is_bundle(r.content) and r.content)
    assert bundle_payload(raw) == b'{"t":1}'


def test_full_story_over_real_bpv7(client):
    c = client
    assert c.get("/api/stats").json()["transport"] == "dtn"
    c.post("/api/sim/step", json={"scenario": "normal", "count": 40})

    # 1. link cut at the network level: earth container leaves the docker network
    c.post("/api/link", json={"state": "down"})
    spike = c.post("/api/sim/step", json={"scenario": "spike", "count": 30}).json()
    assert spike["alerts"]
    c.post("/api/checkin", json={"feeling": "a_bit_off", "symptom": "dizzy"})
    time.sleep(2)
    assert c.get("/api/earth").json()["briefs"] == []

    # 2. short window: only headlines cross, as real bundles
    sent = c.post("/api/link/window", json={"budget_bytes": 250}).json()["sent"]
    assert sent and all(s.endswith(":headline") for s in sent)
    assert eventually(lambda: layers_at_earth(c) == {"headline"})

    # 3. restore: context and evidence follow through BPv7
    c.post("/api/link", json={"state": "up"})
    eventually(lambda: layers_at_earth(c) == {"headline", "context", "evidence"})
    eventually(lambda: c.get("/api/stats").json()["in_transit"] == 0)
    brief = c.get("/api/earth").json()["briefs"][-1]
    assert brief["layers"]["context"]["checkin"]["symptom"] == "dizzy"

    # 4. Earth reply travels back as a bundle to dtn://spacecraft/crew
    c.post("/api/earth/reply", json={"brief_id": brief["brief_id"], "text": "Rest 15 min, re-measure."})
    eventually(lambda: c.get("/api/spacecraft").json()["replies"])

    # the Receiver logged each first arrival: three layers and the reply, each exactly once
    ev = c.get("/api/events").json()
    delivered = [e["data"]["layer"] for e in ev if e["kind"] == "bundle_delivered"]
    assert sorted(delivered) == ["context", "evidence", "headline"]
    assert [e["kind"] for e in ev].count("reply_delivered") == 1
    window = next(e for e in ev if e["kind"] == "window")
    assert window["id"] > next(e["id"] for e in ev if e["kind"] == "bundle_delivered")   # window waited for it

    # the BPv7 nodes themselves counted the traffic
    info = httpx.get(f"{EARTH}/status/info").json()
    assert info["delivered"] > 0
    bpv7 = c.get("/api/mission").json()["bpv7"]
    assert bpv7["reachable"] and bpv7["earth"]["delivered"] > 0 and "outgoing" in bpv7["spacecraft"]
