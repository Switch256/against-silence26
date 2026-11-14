"""Real BPv7 transport for MEDLINK, using two dtn7-rs nodes (see backend/dtn/docker-compose.yml).

spacecraft node (HTTP :3020) --TCP CLA over docker network 'aegis-spacelink'--> earth node (HTTP :3021)

- Uplink: each PulseBrief layer is handed to the spacecraft node as one bundle for dtn://earth/medical.
- Downlink: Earth replies are handed to the earth node as bundles for dtn://spacecraft/crew.
- A receiver thread pulls bundles from both nodes, decodes the BPv7 (CBOR) bundle, and records
  the arrival. Only then is a layer or reply marked delivered.
- The space link is cut/restored by disconnecting/connecting the earth container from the network.
"""
import json
import logging
import subprocess
import threading
import time

import cbor2
import httpx
from psycopg_pool import ConnectionPool

from . import medlink

log = logging.getLogger("aegis.dtn")
PAYLOAD_BLOCK = 1           # BPv7 block type code for the payload block
BUNDLE_START = b"\x9f"      # a BPv7 bundle is a CBOR indefinite-length array


def is_bundle(body: bytes) -> bool:
    """dtnd answers an empty endpoint with text ("Nothing to receive") under the same content type."""
    return body[:1] == BUNDLE_START


def bundle_payload(raw: bytes) -> bytes:
    """Extract the payload from a BPv7 bundle: a CBOR array of [primary, canonical blocks...]."""
    blocks = cbor2.loads(raw)
    if not blocks or blocks[0][0] != 7:
        raise ValueError("not a BPv7 bundle")
    for block in blocks[1:]:
        if block[0] == PAYLOAD_BLOCK:
            return block[4]
    raise ValueError("bundle has no payload block")


class DtnTransport:
    """MEDLINK transport over BPv7. Hand-off is asynchronous: delivery is confirmed by the receiver."""
    confirms_delivery = False

    def __init__(self, spacecraft_url: str, earth_url: str, lifetime_s: int = 86400):
        self.spacecraft = httpx.Client(base_url=spacecraft_url, timeout=5)
        self.earth = httpx.Client(base_url=earth_url, timeout=5)
        self.lifetime_s = lifetime_s

    def deliver(self, bundle_id: str, brief_id: str, layer: str, payload: bytes) -> bool:
        envelope = {"kind": "layer", "bundle_id": bundle_id, "brief_id": brief_id, "layer": layer,
                    "payload": json.loads(payload)}
        return self._send(self.spacecraft, "dtn://earth/medical", envelope)

    def send_reply(self, reply_id: str, brief_id: str, text: str) -> bool:
        envelope = {"kind": "reply", "reply_id": reply_id, "brief_id": brief_id, "text": text}
        return self._send(self.earth, "dtn://spacecraft/crew", envelope)

    def status(self) -> dict:
        """Bundle counters from both nodes; never raises (a dead node just reads as unreachable)."""
        info = {name: _node_info(node) for name, node in (("spacecraft", self.spacecraft), ("earth", self.earth))}
        return {**info, "reachable": all(v is not None for v in info.values())}

    def _send(self, node: httpx.Client, dst: str, envelope: dict) -> bool:
        body = json.dumps(envelope, separators=(",", ":")).encode()
        try:
            r = node.post("/send", params={"dst": dst, "lifetime": self.lifetime_s}, content=body)
        except httpx.HTTPError as e:
            log.warning("BPv7 node unreachable: %s", e)
            return False
        return r.status_code == 200 and r.text.startswith("Sent")


def _node_info(node: httpx.Client) -> dict | None:
    try:
        r = node.get("/status/info", timeout=1)
        return r.json() if r.status_code == 200 else None
    except (httpx.HTTPError, ValueError):
        return None


class Receiver(threading.Thread):
    """Pulls bundles off both nodes and records what actually arrived."""

    def __init__(self, pool: ConnectionPool, transport: DtnTransport, interval_s: float = 0.5):
        super().__init__(daemon=True, name="dtn-receiver")
        self.pool, self.transport, self.interval_s = pool, transport, interval_s
        self.stopping = threading.Event()

    def run(self) -> None:
        while not self.stopping.is_set():
            try:
                self.poll_once()
            except Exception:                              # keep receiving even if one bundle is bad
                log.exception("receiver error")
            self.stopping.wait(self.interval_s)

    def poll_once(self) -> int:
        n = 0
        for node, endpoint in ((self.transport.earth, "medical"), (self.transport.spacecraft, "crew")):
            while (raw := self._fetch(node, endpoint)) is not None:
                self._record(json.loads(bundle_payload(raw)))
                n += 1
        return n

    def _fetch(self, node: httpx.Client, endpoint: str) -> bytes | None:
        try:
            r = node.get(f"/endpoint?{endpoint}")
        except httpx.HTTPError:
            return None
        return r.content if r.status_code == 200 and is_bundle(r.content) else None

    def _record(self, env: dict) -> None:
        if env.get("kind") == "layer":
            medlink.EarthInbox(self.pool).deliver(env["bundle_id"], env["brief_id"], env["layer"],
                                                  json.dumps(env["payload"]).encode())
            medlink.mark_delivered(self.pool, env["bundle_id"])
        elif env.get("kind") == "reply":
            medlink.mark_reply_delivered(self.pool, env["reply_id"])

    def stop(self) -> None:
        self.stopping.set()


class DockerLink:
    """Cuts/restores the space link at the network level."""

    def __init__(self, network: str, container: str, ip: str):
        self.network, self.container, self.ip = network, container, ip

    def set(self, up: bool) -> None:
        connected = self.container in self._members()
        if up and not connected:
            self._docker("network", "connect", "--ip", self.ip, self.network, self.container)
        elif not up and connected:
            self._docker("network", "disconnect", self.network, self.container)

    def _members(self) -> str:
        return self._docker("network", "inspect", self.network, "--format",
                            "{{range .Containers}}{{.Name}} {{end}}")

    @staticmethod
    def _docker(*args: str) -> str:
        return subprocess.run(["docker", *args], check=True, capture_output=True, text=True).stdout


def wait_for(pool: ConnectionPool, ids: list[str], timeout_s: float = 20) -> bool:
    """Wait until these bundles/replies are confirmed delivered (or time out)."""
    deadline = time.monotonic() + timeout_s
    while time.monotonic() < deadline:
        if not medlink.undelivered(pool, ids):
            return True
        time.sleep(0.25)
    return False
