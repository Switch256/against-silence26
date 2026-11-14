"""Synthetic astronaut readings, clearly labelled source='simulator'.

Ranges are illustrative resting values for a healthy adult; they are not NASA astronaut data.
"""
import random
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

from .models import Activity, Reading, SignalQuality

SCENARIOS = ("normal", "spike", "exercise", "loose_watch", "low_oxygen")


@dataclass
class Simulator:
    astronaut_id: str = "crew-01"
    seed: int = 7
    clock: datetime = field(default_factory=lambda: datetime.now(timezone.utc).replace(microsecond=0))
    step_s: int = 1
    _rng: random.Random = field(init=False)
    _spike_step: int = field(default=0, init=False)

    def __post_init__(self):
        self._rng = random.Random(self.seed)

    def next(self, scenario: str = "normal") -> Reading:
        if scenario not in SCENARIOS:
            raise ValueError(f"scenario must be one of {SCENARIOS}")
        self.clock += timedelta(seconds=self.step_s)
        rng = self._rng
        hr, spo2 = 72 + rng.gauss(0, 2), 98 + rng.gauss(0, 0.5)
        activity, quality = Activity.rest, SignalQuality.good

        if scenario == "spike":
            self._spike_step += 1                        # climbs ~1.5 bpm per reading at rest
            hr = 72 + min(self._spike_step * 1.5, 45) + rng.gauss(0, 1.5)
        else:
            self._spike_step = 0
        if scenario == "exercise":
            activity, hr = Activity.exercise, 135 + rng.gauss(0, 6)
        elif scenario == "loose_watch":
            quality, hr = SignalQuality.poor, rng.uniform(40, 170)
        elif scenario == "low_oxygen":
            spo2 = 89 + rng.gauss(0, 0.5)

        return Reading(astronaut_id=self.astronaut_id, ts=self.clock, heart_rate=round(hr, 1),
                       spo2=round(min(spo2, 100), 1), activity=activity, signal_quality=quality,
                       source="simulator")
