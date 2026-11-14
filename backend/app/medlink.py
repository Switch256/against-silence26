"""MEDLINK: persistent outbox, simulated space link, Earth inbox and replies.

Bundles leave in priority order: every headline before any context, every context
before any evidence; within a layer, urgent before review before routine, then oldest.
The transport is pluggable: EarthInbox delivers in-process for the demo; a BPv7
transport (dtn7-rs) can replace it without touching the queue logic.
"""
import uuid
from typing import Protocol

from psycopg_pool import ConnectionPool

from .models import Severity
from .pulsebrief import LAYER_RANK, BriefLayer

SEVERITY_RANK = {Severity.routine: 0, Severity.review: 1, Severity.urgent: 2}
LINK_STATES = ("up", "down")


class Transport(Protocol):
    def deliver(self, bundle_id: str, brief_id: str, layer: str, payload: bytes) -> bool:
        """Hand one bundle to the other side; True once it is acknowledged."""


class EarthInbox:
    """Earth side, in the same database. Duplicate deliveries are ignored."""

    def __init__(self, pool: ConnectionPool):
        self.pool = pool

    def deliver(self, bundle_id: str, brief_id: str, layer: str, payload: bytes) -> bool:
        with self.pool.connection() as conn:
            conn.execute(
                "INSERT INTO earth_inbox (bundle_id, brief_id, layer, payload) VALUES (%s, %s, %s, %s) "
                "ON CONFLICT (bundle_id) DO NOTHING",
                (bundle_id, brief_id, layer, payload.decode()))
        return True


# ---- spacecraft outbox ----

def enqueue(pool: ConnectionPool, layers: list[BriefLayer], severity: Severity) -> str:
    brief_id = layers[0].payload["id"]
    with pool.connection() as conn, conn.transaction():
        for layer in layers:
            data = layer.encode()
            conn.execute(
                "INSERT INTO bundles (bundle_id, brief_id, layer, layer_rank, severity, severity_rank, payload, size_bytes) "
                "VALUES (%s, %s, %s, %s, %s, %s, %s, %s)",
                (f"{brief_id}:{layer.layer.value}", brief_id, layer.layer.value, LAYER_RANK[layer.layer],
                 severity.value, SEVERITY_RANK[severity], data, len(data)))
    return brief_id


def update_layer(pool: ConnectionPool, brief_id: str, layer: BriefLayer) -> bool:
    """Refresh a layer that has not left yet (e.g. context after a new check-in)."""
    data = layer.encode()
    with pool.connection() as conn:
        cur = conn.execute(
            "UPDATE bundles SET payload = %s, size_bytes = %s WHERE bundle_id = %s AND status = 'queued'",
            (data, len(data), f"{brief_id}:{layer.layer.value}"))
        return cur.rowcount == 1


def outbox(pool: ConnectionPool, status: str | None = None) -> list[dict]:
    with pool.connection() as conn:
        return conn.execute(
            "SELECT bundle_id, brief_id, layer, severity, size_bytes, status, created, delivered_at FROM bundles "
            "WHERE %(s)s::text IS NULL OR status = %(s)s ORDER BY status DESC, layer_rank, severity_rank DESC, created",
            {"s": status}).fetchall()


# ---- the link ----

def link(pool: ConnectionPool) -> dict:
    with pool.connection() as conn:
        return conn.execute("SELECT state, bytes_sent FROM link_state WHERE id = 1").fetchone()


def set_link(pool: ConnectionPool, transport: Transport, state: str) -> list[str]:
    if state not in LINK_STATES:
        raise ValueError(f"link state must be one of {LINK_STATES}")
    with pool.connection() as conn:
        conn.execute("UPDATE link_state SET state = %s WHERE id = 1", (state,))
    return flush(pool, transport) if state == "up" else []


def open_window(pool: ConnectionPool, transport: Transport, budget_bytes: int) -> list[str]:
    """A short contact: send what fits in the byte budget, then the link drops again."""
    sent = flush(pool, transport, budget_bytes=budget_bytes, force=True)
    with pool.connection() as conn:
        conn.execute("UPDATE link_state SET state = 'down' WHERE id = 1")
    return sent


def flush(pool: ConnectionPool, transport: Transport, budget_bytes: int | None = None,
          force: bool = False) -> list[str]:
    """Send queued bundles (then queued replies) while the link allows. Returns sent ids."""
    if not force and link(pool)["state"] != "up":
        return []
    sent: list[str] = []
    left = budget_bytes
    with pool.connection() as conn, conn.transaction():
        rows = conn.execute(
            "SELECT bundle_id, brief_id, layer, payload, size_bytes FROM bundles WHERE status = 'queued' "
            "ORDER BY layer_rank, severity_rank DESC, created FOR UPDATE SKIP LOCKED").fetchall()
        for row in rows:
            if left is not None and row["size_bytes"] > left:
                break                                   # keep strict priority order
            if not transport.deliver(row["bundle_id"], row["brief_id"], row["layer"], bytes(row["payload"])):
                break
            conn.execute("UPDATE bundles SET status = 'delivered', delivered_at = now() WHERE bundle_id = %s",
                         (row["bundle_id"],))
            conn.execute("UPDATE link_state SET bytes_sent = bytes_sent + %s WHERE id = 1", (row["size_bytes"],))
            sent.append(row["bundle_id"])
            if left is not None:
                left -= row["size_bytes"]
        replies = conn.execute(
            "SELECT reply_id, length(text) AS size FROM replies WHERE status = 'queued' ORDER BY created "
            "FOR UPDATE SKIP LOCKED").fetchall()
        for r in replies:
            if left is not None and r["size"] > left:
                break
            conn.execute("UPDATE replies SET status = 'delivered', delivered_at = now() WHERE reply_id = %s",
                         (r["reply_id"],))
            sent.append(r["reply_id"])
            if left is not None:
                left -= r["size"]
    return sent


# ---- Earth side ----

def earth_briefs(pool: ConnectionPool) -> list[dict]:
    """Received briefs, newest first, with whichever layers have arrived so far."""
    with pool.connection() as conn:
        rows = conn.execute(
            "SELECT brief_id, layer, payload, received_at FROM earth_inbox ORDER BY received_at").fetchall()
    briefs: dict[str, dict] = {}
    for r in rows:
        b = briefs.setdefault(r["brief_id"], {"brief_id": r["brief_id"], "layers": {}, "first_received": r["received_at"]})
        b["layers"][r["layer"]] = r["payload"]
    return sorted(briefs.values(), key=lambda b: b["first_received"], reverse=True)


def reply(pool: ConnectionPool, transport: Transport, brief_id: str, text: str,
          author: str = "Earth medical team") -> str:
    reply_id = f"rp-{uuid.uuid4().hex[:10]}"
    with pool.connection() as conn:
        conn.execute("INSERT INTO replies (reply_id, brief_id, text, author) VALUES (%s, %s, %s, %s)",
                     (reply_id, brief_id, text, author))
    flush(pool, transport)
    return reply_id


def replies(pool: ConnectionPool, status: str | None = None) -> list[dict]:
    with pool.connection() as conn:
        return conn.execute(
            "SELECT reply_id, brief_id, text, author, created, status, delivered_at FROM replies "
            "WHERE %(s)s::text IS NULL OR status = %(s)s ORDER BY created DESC", {"s": status}).fetchall()
