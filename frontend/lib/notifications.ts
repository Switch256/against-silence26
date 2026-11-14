// Turns new /api/mission events into the on-screen live feed for the moments that matter:
// AEGIS alerts, crew check-ins (coloured by how they feel), steps done, PulseBrief layers received
// on Earth, replies, link lost / restored / short window, and space-weather changes.
// Items stay on screen (newest on top) until dismissed or cleared; the full history is in the log.
import type { MissionEvent } from "./api";
import { FLIGHT_MIN_S, LAYER_LABEL } from "./constants";
import { autoCameraOnEvent } from "./autoCamera";
import { markFresh, useStore, type Toast } from "./store";

const MAX_TOASTS = 8;
const FEELING: Record<string, { level: Toast["level"]; word: string }> = {
  fine: { level: "nominal", word: "fine" },
  a_bit_off: { level: "caution", word: "a bit off" },
  unwell: { level: "warning", word: "unwell" },
};

let seen: Set<string> | null = null;
export const eventKey = (e: MissionEvent) => `${e.ts}|${e.kind}|${e.text}`;

function toastFor(e: MissionEvent): Omit<Toast, "id" | "ts"> | null {
  const d = e.data ?? {};
  switch (e.kind) {
    case "alert": {
      const sev = d.severity as string | undefined;
      const metric = (d.metric as string) === "space_weather" ? "Space weather" : (d.metric as string) === "spo2" ? "Blood oxygen" : "Heart rate";
      return { level: sev === "urgent" ? "warning" : sev === "review" ? "caution" : "info", title: `New AEGIS alert · ${metric}`, detail: e.text,
               target: { panel: "crew" } };
    }
    case "bundle_delivered": {
      const layer = (d.layer as keyof typeof LAYER_LABEL) ?? "headline";
      return { level: "info", title: `${LAYER_LABEL[layer] ?? "Layer"} received on Earth`, detail: `PulseBrief ${d.brief_id ?? ""} · ${e.text}`,
               group: `brief:${d.brief_id}`, target: { panel: "earth", briefId: d.brief_id as string | undefined } };
    }
    case "checkin": {
      const f = FEELING[d.feeling as string] ?? { level: "info" as const, word: String(d.feeling ?? "") };
      return { level: f.level, title: `Crew feels ${f.word}`, detail: d.symptom ? `Symptom: ${d.symptom}` : "3-tap check-in · travels with the next PulseBrief",
               target: { panel: "crew" } };
    }
    case "step_done":
      return { level: "nominal", title: "Crew completed a step", detail: String(d.step ?? e.text) };
    case "reply_queued":
      return { level: "info", title: "Earth sent a reply", detail: "Queued for the crew · waits for the link", target: { panel: "earth", briefId: d.brief_id as string | undefined } };
    case "reply_delivered": {
      const reply = useStore.getState().spacecraft?.replies?.find((r) => r.reply_id === d.reply_id);
      return { level: "nominal", title: "Message from Earth", detail: reply ? `“${reply.text}”` : "Reply delivered to the crew", target: { panel: "crew" } };
    }
    case "link_down":
      return { level: "warning", title: "Link lost", detail: "Bundles are held on board until the next contact" };
    case "link_up":
      return { level: "nominal", title: "Link restored", detail: "Outbox is flushing in priority order" };
    case "window":
      return { level: "caution", title: "Short contact window", detail: e.text };
    case "space_weather": {
      const lvl = d.level as string | undefined;
      return { level: lvl === "warning" ? "warning" : lvl === "caution" ? "caution" : "info", title: "Space weather · NASA DONKI", detail: e.text.replace(/^Replaying NASA DONKI: /, "") };
    }
    default:
      return null;
  }
}

function push(t: Omit<Toast, "id" | "ts">, ts: string) {
  const id = `${ts}-${Math.random().toString(36).slice(2, 7)}`;
  useStore.setState((s) => {
    // one toast per brief: a later layer replaces the earlier one
    const rest = t.group ? s.toasts.filter((x) => x.group !== t.group) : s.toasts;
    return { toasts: [{ ...t, id, ts }, ...rest].slice(0, MAX_TOASTS) };
  });
}

export function resetNotifications() {
  seen = null;
  useStore.setState({ toasts: [], unread: 0 });
}

export function ingestEvents(events: MissionEvent[]) {
  const keys = events.map(eventKey);
  if (seen === null) {
    seen = new Set(keys);
    return;
  }
  // oldest first, so toasts stack in the order things happened
  const fresh = events.filter((_, i) => !seen!.has(keys[i])).reverse();
  if (!fresh.length) return;
  fresh.forEach((e) => seen!.add(eventKey(e)));
  if (!useStore.getState().logOpen) useStore.setState((s) => ({ unread: s.unread + fresh.length }));
  for (const e of fresh) {
    autoCameraOnEvent(e);
    const t = toastFor(e);
    const d = e.data ?? {};
    if (e.kind === "bundle_delivered" && d.brief_id) {
      // wait for the marker to land on screen before announcing the arrival
      window.setTimeout(() => markFresh(d.brief_id as string), FLIGHT_MIN_S * 1000);
      if (t) window.setTimeout(() => push(t, e.ts), FLIGHT_MIN_S * 1000);
      continue;
    }
    if (e.kind === "reply_delivered" && d.reply_id) window.setTimeout(() => markFresh(d.reply_id as string), FLIGHT_MIN_S * 1000);
    if (t) window.setTimeout(() => push(t, e.ts), e.kind === "reply_delivered" ? FLIGHT_MIN_S * 1000 : 0);
  }
}
