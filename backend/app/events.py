"""Mission events log: short plain-English lines for the timeline and the 3D simulation."""
from psycopg import Connection
from psycopg.types.json import Jsonb
from psycopg_pool import ConnectionPool


def add(conn: Connection, kind: str, text: str, **data) -> None:
    """Record an event on an open connection (joins the caller's transaction)."""
    conn.execute("INSERT INTO events (kind, text, data) VALUES (%s, %s, %s)", (kind, text, Jsonb(data)))


def log(pool: ConnectionPool, kind: str, text: str, **data) -> None:
    with pool.connection() as conn:
        add(conn, kind, text, **data)


def recent(pool: ConnectionPool, limit: int = 40) -> list[dict]:
    """Newest first."""
    with pool.connection() as conn:
        return conn.execute("SELECT ts, kind, text, data FROM events ORDER BY id DESC LIMIT %s",
                            (limit,)).fetchall()


def since(pool: ConnectionPool, since_id: int = 0, limit: int = 500) -> list[dict]:
    """Events after since_id, oldest first (for incremental polling)."""
    with pool.connection() as conn:
        return conn.execute("SELECT id, ts, kind, text, data FROM events WHERE id > %s ORDER BY id LIMIT %s",
                            (since_id, limit)).fetchall()
