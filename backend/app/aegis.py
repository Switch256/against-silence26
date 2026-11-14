"""AEGIS: rule-and-statistics health check (no AI model).

Each reading is compared with the astronaut's own resting baseline. The thresholds
below are illustrative prototype values, not clinically validated limits.
"""
import statistics
import uuid
from dataclasses import dataclass

from .models import Activity, Alert, Reading, Severity, SignalQuality

MIN_BASELINE_SAMPLES = 20          # readings needed before we trust the baseline
MIN_STD_BPM = 3.0                  # floor so a very steady baseline doesn't over-alert
REVIEW_Z, URGENT_Z = 3.0, 5.0
HR_URGENT_HIGH, HR_URGENT_LOW = 140, 40
EXERCISE_URGENT_HR = 185
SPO2_REVIEW, SPO2_URGENT = 94, 90

# Pre-written "what to do now" steps (placeholders until reviewed by a clinician).
TODO = {
    "heart_rate_high": ["Sit down and rest", "Drink water", "Re-measure in 5 minutes"],
    "heart_rate_low": ["Sit or lie down", "Tell a crewmate", "Re-measure in 5 minutes"],
    "spo2_low": ["Stop activity and rest", "Check the sensor fit", "Re-measure in 2 minutes"],
}


@dataclass
class Baseline:
    mean: float
    std: float
    samples: int


def baseline_from(history: list[Reading]) -> Baseline | None:
    """Resting, good-signal readings only: exercise and noisy data would skew 'normal'."""
    hr = [r.heart_rate for r in history
          if r.activity == Activity.rest and r.signal_quality == SignalQuality.good]
    if len(hr) < MIN_BASELINE_SAMPLES:
        return None
    return Baseline(statistics.fmean(hr), max(statistics.pstdev(hr), MIN_STD_BPM), len(hr))


def evaluate(reading: Reading, history: list[Reading]) -> Alert | None:
    """Return an alert for this reading, or None when it looks normal or can't be trusted."""
    if reading.signal_quality == SignalQuality.poor:
        return None                                   # a loose watch is not a medical event

    if reading.spo2 is not None and reading.spo2 < SPO2_REVIEW:
        severity = Severity.urgent if reading.spo2 < SPO2_URGENT else Severity.review
        return _alert(reading, "spo2", reading.spo2, None, None, severity,
                      f"Blood oxygen {reading.spo2:.0f}% is below {SPO2_REVIEW}%.", "spo2_low")

    hr = reading.heart_rate
    base = baseline_from(history)
    z = (hr - base.mean) / base.std if base else None

    if reading.activity == Activity.exercise:
        if hr >= EXERCISE_URGENT_HR:
            return _alert(reading, "heart_rate", hr, base, z, Severity.urgent,
                          f"Heart rate {hr:.0f} bpm is very high even for exercise.", "heart_rate_high")
        return None                                   # fast heart rate during exercise is expected

    if hr >= HR_URGENT_HIGH or hr <= HR_URGENT_LOW:
        key = "heart_rate_high" if hr >= HR_URGENT_HIGH else "heart_rate_low"
        return _alert(reading, "heart_rate", hr, base, z, Severity.urgent,
                      f"Heart rate {hr:.0f} bpm is outside the safe range at {reading.activity.value}.", key)

    if z is None or abs(z) < REVIEW_Z:
        return None
    severity = Severity.urgent if abs(z) >= URGENT_Z else Severity.review
    direction = "above" if z > 0 else "below"
    return _alert(reading, "heart_rate", hr, base, z, severity,
                  f"Heart rate {hr:.0f} bpm is {abs(hr - base.mean):.0f} bpm {direction} this astronaut's "
                  f"resting normal ({base.mean:.0f} bpm) while at {reading.activity.value}.",
                  "heart_rate_high" if z > 0 else "heart_rate_low")


def _alert(r: Reading, metric: str, value: float, base: Baseline | None, z: float | None,
           severity: Severity, reason: str, todo_key: str) -> Alert:
    return Alert(alert_id=f"al-{uuid.uuid4().hex[:10]}", astronaut_id=r.astronaut_id, ts=r.ts,
                 metric=metric, value=round(value, 1), baseline=round(base.mean, 1) if base else None,
                 deviation=round(z, 2) if z is not None else None, severity=severity, reason=reason,
                 activity=r.activity, signal_quality=r.signal_quality, todo=TODO[todo_key])
