"""Settings read from backend/.env (see .env.example)."""
import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")


@dataclass(frozen=True)
class Settings:
    database_url: str
    astronaut_id: str = "crew-01"
    one_way_delay_min: float = 14
    next_window_min: float = 12
    transport: str = "local"                     # "local" or "dtn"
    dtn_spacecraft_url: str = "http://127.0.0.1:3020"
    dtn_earth_url: str = "http://127.0.0.1:3021"
    dtn_network: str = "aegis-spacelink"
    dtn_earth_container: str = "aegis-dtn-earth"
    dtn_earth_ip: str = "172.31.0.20"
    nasa_api_key: str = "DEMO_KEY"               # free key from https://api.nasa.gov raises the rate limit
    live_sim: bool = False                       # stream one simulated reading per second, like live telemetry


def get_settings(database_url: str | None = None) -> Settings:
    url = database_url or os.environ.get("DATABASE_URL")
    if not url:
        raise RuntimeError("DATABASE_URL is not set; copy backend/.env.example to backend/.env")
    return Settings(
        database_url=url,
        astronaut_id=os.environ.get("ASTRONAUT_ID", "crew-01"),
        one_way_delay_min=float(os.environ.get("ONE_WAY_DELAY_MIN", 14)),
        next_window_min=float(os.environ.get("NEXT_WINDOW_MIN", 12)),
        transport=os.environ.get("MEDLINK_TRANSPORT", "local"),
        dtn_spacecraft_url=os.environ.get("DTN_SPACECRAFT_URL", "http://127.0.0.1:3020"),
        dtn_earth_url=os.environ.get("DTN_EARTH_URL", "http://127.0.0.1:3021"),
        dtn_network=os.environ.get("DTN_NETWORK", "aegis-spacelink"),
        dtn_earth_container=os.environ.get("DTN_EARTH_CONTAINER", "aegis-dtn-earth"),
        dtn_earth_ip=os.environ.get("DTN_EARTH_IP", "172.31.0.20"),
        nasa_api_key=os.environ.get("NASA_API_KEY", "DEMO_KEY"),
        live_sim=os.environ.get("LIVE_SIM", "0").lower() in ("1", "true", "yes"),
    )
