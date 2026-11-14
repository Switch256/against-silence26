"""Postgres connection pool. The schema is managed by Alembic (alembic upgrade head)."""
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

TABLES = ("readings", "alerts", "checkins", "bundles", "earth_inbox", "replies", "events")


def open_pool(database_url: str) -> ConnectionPool:
    return ConnectionPool(database_url, min_size=1, max_size=5,
                          kwargs={"row_factory": dict_row, "autocommit": True}, open=True)


def reset(pool: ConnectionPool) -> None:
    """Empty every table; used by tests and the demo's reset button."""
    with pool.connection() as conn:
        conn.execute(f"TRUNCATE {', '.join(TABLES)}")
        conn.execute("UPDATE link_state SET state = 'up', bytes_sent = 0, window_until = NULL")
