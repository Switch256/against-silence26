"""Data shapes shared by every part of the backend and exposed to the frontend."""
from datetime import datetime
from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field


class Activity(str, Enum):
    rest = "rest"
    exercise = "exercise"
    sleep = "sleep"


class SignalQuality(str, Enum):
    good = "good"
    poor = "poor"


class Severity(str, Enum):
    routine = "routine"
    review = "review"
    urgent = "urgent"


class Layer(str, Enum):
    """PulseBrief layers, in the order they are sent."""
    headline = "headline"
    context = "context"
    evidence = "evidence"


class Reading(BaseModel):
    astronaut_id: str = "crew-01"
    ts: datetime
    heart_rate: float = Field(gt=0, lt=300, description="beats per minute")
    spo2: float | None = Field(default=None, ge=50, le=100, description="blood oxygen, %")
    activity: Activity = Activity.rest
    signal_quality: SignalQuality = SignalQuality.good
    source: Literal["simulator", "nasa-scenario", "ble"] = "simulator"


class CheckIn(BaseModel):
    astronaut_id: str = "crew-01"
    feeling: Literal["fine", "a_bit_off", "unwell"]
    symptom: str | None = Field(default=None, max_length=60)


class Alert(BaseModel):
    alert_id: str
    astronaut_id: str
    ts: datetime
    metric: Literal["heart_rate", "spo2", "space_weather"]
    value: float
    baseline: float | None
    deviation: float | None = Field(description="z-score against the personal baseline")
    severity: Severity
    reason: str
    activity: Activity
    signal_quality: SignalQuality
    todo: list[str] = Field(description="pre-written 'what to do now' steps")


class Bundle(BaseModel):
    """One PulseBrief layer as it travels over MEDLINK."""
    bundle_id: str
    brief_id: str
    layer: Layer
    severity: Severity
    size_bytes: int
    status: Literal["queued", "in_transit", "delivered"]
    created: datetime
    sent_at: datetime | None = Field(default=None, description="handed to the link (BPv7 node)")
    delivered_at: datetime | None = Field(default=None, description="seen arriving on Earth")


class Reply(BaseModel):
    reply_id: str
    brief_id: str
    text: str
    author: str = "Earth medical team"
    created: datetime
    status: Literal["queued", "in_transit", "delivered"] = "queued"
