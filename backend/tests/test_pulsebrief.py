from datetime import datetime, timedelta, timezone

from app.aegis import evaluate
from app.models import CheckIn, Layer, Reading
from app.pulsebrief import build, raw_size

T0 = datetime(2026, 11, 14, 12, 0, tzinfo=timezone.utc)


def history_with_spike():
    rows = [Reading(ts=T0 + timedelta(seconds=i), heart_rate=72 + (i % 5) - 2) for i in range(600)]
    spike = Reading(ts=T0 + timedelta(seconds=600), heart_rate=110, spo2=97)
    return rows, spike


def make_brief(**kw):
    history, spike = history_with_spike()
    alert = evaluate(spike, history)
    return build(alert, history + [spike], **kw), history + [spike]


def test_three_layers_in_send_order():
    layers, _ = make_brief()
    assert [l.layer for l in layers] == [Layer.headline, Layer.context, Layer.evidence]


def test_headline_fits_in_about_200_bytes():
    layers, _ = make_brief()
    assert len(layers[0].encode()) <= 200
    assert layers[0].payload["sev"] == "urgent" and layers[0].payload["base"] == 72.0


def test_context_carries_checkin_and_done_steps():
    layers, _ = make_brief(checkin=CheckIn(feeling="a_bit_off", symptom="dizzy"), done=["Drink water"])
    ctx = layers[1].payload
    assert ctx["checkin"] == {"feeling": "a_bit_off", "symptom": "dizzy"}
    assert ctx["done"] == ["Drink water"] and ctx["simulated"] is True


def test_evidence_covers_one_minute_around_the_event():
    layers, _ = make_brief()
    offsets = [p[0] for p in layers[2].payload["hr"]]
    assert min(offsets) == -60 and max(offsets) == 0


def test_whole_brief_is_much_smaller_than_raw_readings():
    layers, history = make_brief()
    brief_bytes = sum(len(l.encode()) for l in layers)
    assert brief_bytes * 10 < raw_size(history)
