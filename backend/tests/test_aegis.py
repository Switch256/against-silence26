from datetime import datetime, timedelta, timezone

from app.aegis import evaluate
from app.models import Activity, Reading, Severity, SignalQuality

T0 = datetime(2026, 11, 14, 12, 0, tzinfo=timezone.utc)


def reading(hr, i=0, **kw):
    return Reading(ts=T0 + timedelta(seconds=i), heart_rate=hr, **kw)


def resting_history(n=40, base=72):
    # gentle wobble around the base so the baseline has a realistic spread
    return [reading(base + (i % 5) - 2, i) for i in range(n)]


def test_no_alert_before_baseline_is_ready():
    assert evaluate(reading(110), resting_history(5)) is None


def test_normal_reading_does_not_alert():
    assert evaluate(reading(74), resting_history()) is None


def test_high_heart_rate_at_rest_alerts_with_reason_and_todo():
    alert = evaluate(reading(110), resting_history())
    assert alert is not None
    assert alert.severity == Severity.urgent
    assert alert.baseline == 72.0
    assert "above this astronaut's resting normal (72 bpm)" in alert.reason
    assert alert.todo[0] == "Sit down and rest"


def test_moderate_rise_is_review_not_urgent():
    alert = evaluate(reading(84), resting_history())
    assert alert is not None and alert.severity == Severity.review


def test_same_heart_rate_during_exercise_is_fine():
    assert evaluate(reading(110, activity=Activity.exercise), resting_history()) is None


def test_extreme_heart_rate_during_exercise_still_alerts():
    alert = evaluate(reading(190, activity=Activity.exercise), resting_history())
    assert alert is not None and alert.severity == Severity.urgent


def test_poor_signal_never_alerts():
    assert evaluate(reading(150, signal_quality=SignalQuality.poor), resting_history()) is None


def test_exercise_readings_do_not_shift_the_baseline():
    history = resting_history() + [reading(150, 100 + i, activity=Activity.exercise) for i in range(30)]
    alert = evaluate(reading(110), history)
    assert alert is not None and alert.baseline == 72.0


def test_low_oxygen_alerts_without_baseline():
    alert = evaluate(reading(72, spo2=89), [])
    assert alert is not None and alert.metric == "spo2" and alert.severity == Severity.urgent
