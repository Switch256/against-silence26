import os
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config

from app import config  # noqa: F401  (loads backend/.env)

os.environ["MEDLINK_TRANSPORT"] = "local"      # unit/API tests run in-process; see test_dtn.py for BPv7
from app.db import open_pool, reset

BACKEND = Path(__file__).resolve().parent.parent


@pytest.fixture(scope="session")
def pool():
    url = os.environ.get("TEST_DATABASE_URL")
    if not url:
        pytest.skip("TEST_DATABASE_URL is not set")
    cfg = Config(str(BACKEND / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND / "migrations"))
    cfg.set_main_option("sqlalchemy.url", url)
    command.upgrade(cfg, "head")
    p = open_pool(url)
    yield p
    p.close()


@pytest.fixture
def db(pool):
    reset(pool)
    return pool
