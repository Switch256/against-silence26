"""MEDLINK: persistent outbox, simulated space link, Earth inbox and replies.

Bundles leave in priority order: every headline before any context, every context
before any evidence; within a layer, urgent before review before routine, then oldest.
The transport is pluggable: EarthInbox delivers in-process (tests, quick demos);
app.dtn.DtnTransport sends real BPv7 bundles through dtn7-rs nodes. Bundle status:
queued -> in_transit (handed to the BPv7 node) -> delivered (seen arriving on the other side).
"""
import uuid
from typing import Protocol

from psycopg_pool import ConnectionPool

from . import events
from .models import Severity
from .pulsebrief import LAYER_RANK, BriefLayer

SEVERITY_RANK = {Severity.routine: 0, Severity.review: 1, Severity.urgent: 2}
LINK_STATES = ("up", "down")


def _sent_event(conn, bundle_id: str, layer: str, size: int) -> None:
    events.add(conn, "bundle_sent", f"{layer.capitalize()} handed to the link ({size} B)",
               layer=layer, bundle_id=bundle_id, size=size)


def _delivered_event(conn, bundle_id: str, layer: str, size: int) -> None:
    events.add(conn, "bundle_delivered", f"{layer.capitalize()} crossed the link ({size} B)",
               layer=layer, bundle_id=bundle_id, size=size)


def _reply_delivered_event(conn, reply_id: str, brief_id: str) -> None:
    events.add(conn, "reply_delivered", "Earth reply reached the crew", reply_id=reply_id, brief_id=brief_id)


class Transport(Protocol):
    confirms_delivery: bool     # True: deliver() returning True means it arrived; False: arrival confirmed later

    def deliver(self, bundle_id: str, brief_id: str, layer: str, payload: bytes) -> bool:
        """Hand one PulseBrief layer towards Earth; False if it could not be handed over."""

    def send_reply(self, reply_id: str, brief_id: str, text: str) -> bool:
        """Hand one Earth reply towards the spacecraft."""


class EarthInbox:
    """Earth side, in the same database. Duplicate deliveries are ignored."""
    confirms_delivery = True

    def __init__(self, pool: ConnectionPool):
        self.pool = pool

    def deliver(self, bundle_id: str, brief_id: str, layer: str, payload: bytes) -> bool:
        with self.pool.connection() as conn:
            conn.execute(
                "INSERT INTO earth_inbox (bundle_id, brief_id, layer, payload) VALUES (%s, %s, %s, %s) "
                "ON CONFLICT (bundle_id) DO NOTHING",
                (bundle_id, brief_id, layer, payload.decode()))
        return True

    def send_reply(self, reply_id: str, brief_id: str, text: str) -> bool:
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
        events.add(conn, f"link_{state}", "Link restored" if state == "up" else "Link lost")
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
    confirmed = transport.confirms_delivery
    done = "delivered" if confirmed else "in_transit"
    with pool.connection() as conn, conn.transaction():
        rows = conn.execute(
            "SELECT bundle_id, brief_id, layer, payload, size_bytes FROM bundles WHERE status = 'queued' "
            "ORDER BY layer_rank, severity_rank DESC, created FOR UPDATE SKIP LOCKED").fetchall()
        for row in rows:
            if left is not None and row["size_bytes"] > left:
                break                                   # keep strict priority order
            if not transport.deliver(row["bundle_id"], row["brief_id"], row["layer"], bytes(row["payload"])):
                break
            conn.execute("UPDATE bundles SET status = %s, delivered_at = CASE WHEN %s THEN now() END "
                         "WHERE bundle_id = %s", (done, confirmed, row["bundle_id"]))
            conn.execute("UPDATE link_state SET bytes_sent = bytes_sent + %s WHERE id = 1", (row["size_bytes"],))
            _sent_event(conn, row["bundle_id"], row["layer"], row["size_bytes"])
            if confirmed:
                _delivered_event(conn, row["bundle_id"], row["layer"], row["size_bytes"])
            sent.append(row["bundle_id"])
            if left is not None:
                left -= row["size_bytes"]
        replies = conn.execute(
            "SELECT reply_id, brief_id, text, length(text) AS size FROM replies WHERE status = 'queued' "
            "ORDER BY created FOR UPDATE SKIP LOCKED").fetchall()
        for r in replies:
            if left is not None and r["size"] > left:
                break
            if not transport.send_reply(r["reply_id"], r["brief_id"], r["text"]):
                break
            conn.execute("UPDATE replies SET status = %s, delivered_at = CASE WHEN %s THEN now() END "
                         "WHERE reply_id = %s", (done, confirmed, r["reply_id"]))
            if confirmed:
                _reply_delivered_event(conn, r["reply_id"], r["brief_id"])
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
        events.add(conn, "reply_queued", "Earth reply queued for the crew", reply_id=reply_id, brief_id=brief_id)
    flush(pool, transport)
    return reply_id


def replies(pool: ConnectionPool, status: str | None = None) -> list[dict]:
    with pool.connection() as conn:
        return conn.execute(
            "SELECT reply_id, brief_id, text, author, created, status, delivered_at FROM replies "
            "WHERE %(s)s::text IS NULL OR status = %(s)s ORDER BY created DESC", {"s": status}).fetchall()


# ---- delivery confirmations (used by asynchronous transports) ----

def mark_delivered(pool: ConnectionPool, bundle_id: str) -> None:
    with pool.connection() as conn:
        row = conn.execute("UPDATE bundles SET status = 'delivered', delivered_at = now() "
                           "WHERE bundle_id = %s AND status <> 'delivered' RETURNING layer, size_bytes",
                           (bundle_id,)).fetchone()
        if row:                                 # first arrival only; duplicates stay quiet
            _delivered_event(conn, bundle_id, row["layer"], row["size_bytes"])


def mark_reply_delivered(pool: ConnectionPool, reply_id: str) -> None:
    with pool.connection() as conn:
        row = conn.execute("UPDATE replies SET status = 'delivered', delivered_at = now() "
                           "WHERE reply_id = %s AND status <> 'delivered' RETURNING brief_id",
                           (reply_id,)).fetchone()
        if row:
            _reply_delivered_event(conn, reply_id, row["brief_id"])


def undelivered(pool: ConnectionPool, ids: list[str]) -> list[str]:
    with pool.connection() as conn:
        rows = conn.execute(
            "SELECT bundle_id AS id FROM bundles WHERE bundle_id = ANY(%(ids)s) AND status <> 'delivered' "
            "UNION ALL SELECT reply_id FROM replies WHERE reply_id = ANY(%(ids)s) AND status <> 'delivered'",
            {"ids": ids}).fetchall()
    return [r["id"] for r in rows]
