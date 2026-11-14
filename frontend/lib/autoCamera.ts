// Auto camera: the view follows what is happening, so the scene directs itself during a demo.
// Events pick the shot (alert -> spacecraft, link change -> overview, arrival on Earth -> ground
// station); when nothing happens it slowly cycles the three views. Any user camera interaction
// pauses it; choosing a view by hand turns it off until "Auto" is selected again.
import type { MissionEvent } from "./api";
import { useStore, type CameraView } from "./store";

const EVENT_VIEW: Record<string, CameraView> = {
  alert: "spacecraft", checkin: "spacecraft", step_done: "spacecraft", reply_delivered: "spacecraft",
  link_down: "overview", link_up: "overview", window: "overview", space_weather: "overview",
  bundle_delivered: "earth", reply_queued: "earth",
};
const EVENT_HOLD_MS = 12_000;          // stay on an event's shot at least this long
const USER_PAUSE_MS = 30_000;          // after the user moves the camera
const IDLE_CYCLE: { view: CameraView; ms: number }[] = [
  { view: "overview", ms: 22_000 }, { view: "spacecraft", ms: 14_000 }, { view: "earth", ms: 14_000 },
];

let holdUntil = 0;
let cycleIndex = 0;
let timer: number | null = null;

function show(view: CameraView, holdMs: number) {
  const s = useStore.getState();
  if (s.view !== view) s.autoSetView(view);
  holdUntil = Date.now() + holdMs;
}

/** A new mission event arrived (called from the notification pipeline). */
export function autoCameraOnEvent(e: MissionEvent) {
  if (!useStore.getState().autoView) return;
  const view = EVENT_VIEW[e.kind];
  if (view) show(view, EVENT_HOLD_MS);
}

/** The user dragged / zoomed / panned: leave the camera alone for a while. */
export function autoCameraUserMoved() {
  holdUntil = Date.now() + USER_PAUSE_MS;
}

export function startAutoCamera() {
  if (timer !== null) return;
  holdUntil = Date.now() + IDLE_CYCLE[0].ms;
  timer = window.setInterval(() => {
    if (!useStore.getState().autoView || Date.now() < holdUntil) return;
    cycleIndex = (cycleIndex + 1) % IDLE_CYCLE.length;
    const next = IDLE_CYCLE[cycleIndex];
    show(next.view, next.ms);
  }, 1000);
}
