"""One entry point for the backend.

    python run.py            migrate the database, then start the API (with reload)
    python run.py serve      start the API only
    python run.py migrate    apply Alembic migrations (upgrade head)
    python run.py test       run the test suite

Options for serve: --host 127.0.0.1 --port 8001 --no-reload
"""
import argparse
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parent


def migrate() -> None:
    from alembic import command
    from alembic.config import Config

    cfg = Config(str(BACKEND / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND / "migrations"))
    command.upgrade(cfg, "head")


def serve(host: str, port: int, reload: bool) -> None:
    import uvicorn

    print(f"AEGIS-MEDLINK  ->  http://{host}:{port}/proto/   (API docs: /docs)")
    uvicorn.run("app.main:app", host=host, port=port, reload=reload, app_dir=str(BACKEND))


def test(extra: list[str]) -> int:
    import pytest

    return pytest.main(["-q", str(BACKEND / "tests"), *extra])


def main() -> int:
    parser = argparse.ArgumentParser(description="AEGIS-MEDLINK backend")
    parser.add_argument("command", nargs="?", default="dev", choices=["dev", "serve", "migrate", "test"])
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8001)
    parser.add_argument("--no-reload", action="store_true")
    args, extra = parser.parse_known_args()

    sys.path.insert(0, str(BACKEND))
    if args.command == "test":
        return test(extra)
    if args.command in ("dev", "migrate"):
        migrate()
    if args.command in ("dev", "serve"):
        serve(args.host, args.port, reload=not args.no_reload)
    return 0


if __name__ == "__main__":
    sys.exit(main())
