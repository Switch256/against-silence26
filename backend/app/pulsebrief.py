"""PulseBrief: one health event as three layers, smallest and most urgent first.

headline  ~200 bytes  who, what changed, how urgent, signal quality
context   ~1 KB       activity, oxygen, astronaut check-in, steps already done
evidence  a few KB    readings around the event
"""
import json
from dataclasses import dataclass

from .models import Alert, CheckIn, Layer, Reading

EVIDENCE_WINDOW_S = 60
LAYER_RANK = {Layer.headline: 0, Layer.context: 1, Layer.evidence: 2}


@dataclass
class BriefLayer:
    layer: Layer
    payload: dict

    def encode(self) -> bytes:
        return json.dumps(self.payload, separators=(",", ":"), ensure_ascii=False).encode()


def build(alert: Alert, history: list[Reading], checkin: CheckIn | None = None,
          done: list[str] | None = None) -> list[BriefLayer]:
    brief_id = alert.alert_id.replace("al-", "pb-")
    t = int(alert.ts.timestamp())
    headline = {
        "v": 1, "id": brief_id, "a": alert.astronaut_id, "t": t, "m": alert.metric,
        "val": alert.value, "base": alert.baseline, "sev": alert.severity.value,
        "sq": alert.signal_quality.value,
    }
    latest = history[-1] if history else None
    context = {
        "id": brief_id, "reason": alert.reason, "activity": alert.activity.value,
        "spo2": latest.spo2 if latest else None,
        "checkin": checkin.model_dump(exclude={"astronaut_id"}) if checkin else None,
        "done": done or [], "todo": alert.todo, "simulated": _simulated(history),
    }
    window = [r for r in history if abs((r.ts - alert.ts).total_seconds()) <= EVIDENCE_WINDOW_S]
    evidence = {
        "id": brief_id, "t0": t, "unit": "bpm",
        # [seconds from the event, heart rate]: compact and easy to chart
        "hr": [[int((r.ts - alert.ts).total_seconds()), round(r.heart_rate)] for r in window],
    }
    return [BriefLayer(Layer.headline, headline), BriefLayer(Layer.context, context),
            BriefLayer(Layer.evidence, evidence)]


def raw_size(history: list[Reading]) -> int:
    """Bytes the same readings would take sent one by one as plain JSON, for comparison."""
    return sum(len(r.model_dump_json().encode()) for r in history)


def _simulated(history: list[Reading]) -> bool:
    return any(r.source != "ble" for r in history)
