// Shared client state: the latest API snapshots plus what the 3D view derives from them
// (packets in flight, the on-board outbox stack, camera preset).
import { create } from "zustand";
import type { Bundle, EarthState, Layer, MissionState, Reply, SpaceWeather, SpacecraftState, Stats } from "./api";
import { DSN_STATIONS, FLIGHT_MAX_S, FLIGHT_MIN_S, LAUNCH_GAP_S, type StationId } from "./constants";

export type CameraView = "overview" | "spacecraft" | "earth";
export type LinkVisual = "up" | "down" | "window";

/** A bundle or reply crossing the link on screen. Timed from the backend's sent_at / delivered_at. */
export interface Flight {
  id: string;
  kind: "bundle" | "reply";
  layer?: Layer;
  /** seconds, performance.now() based */
  start: number;
  duration: number;
  /** the backend has reported delivered_at; until then the marker waits short of the receiver */
  delivered: boolean;
  /** measured BPv7 transfer time (delivered_at - sent_at), seconds */
  measuredS: number | null;
}

export interface QueuedPacket { id: string; layer: Layer; size: number }

interface State {
  spacecraft: SpacecraftState | null;
  earth: EarthState | null;
  stats: Stats | null;
  mission: MissionState | null;
  spaceWeather: SpaceWeather | null;
  online: boolean;
  /** true while showing the built-in demo snapshot because the backend is unreachable */
  demoFallback: boolean;
  lastUpdate: number;

  view: CameraView;
  viewNonce: number;
  flights: Flight[];
  outbox: QueuedPacket[];
  earthQueue: string[];

  setView: (v: CameraView) => void;
  /** Auto camera on: the view follows events (lib/autoCamera.ts). A manual setView turns it off. */
  autoView: boolean;
  setAutoView: (on: boolean) => void;
  /** view change made by the auto camera (keeps autoView on) */
  autoSetView: (v: CameraView) => void;

  // UI: notification layer, drawers
  toasts: Toast[];
  unread: number;
  logOpen: boolean;
  demoOpen: boolean;
  /** brief / reply ids that just arrived, for a short highlight */
  fresh: Record<string, number>;
  setLogOpen: (v: boolean) => void;
  setDemoOpen: (v: boolean) => void;
  dismissToast: (id: string) => void;

  /** side panels (crew console / Earth console) can be hidden to give the 3D view the screen */
  panels: { crew: boolean; earth: boolean };
  togglePanel: (p: "crew" | "earth", show?: boolean) => void;
  setPanels: (panels: { crew: boolean; earth: boolean }) => void;

  /** 3D navigation: rotate around the target, or "hand" = drag to move (pan) */
  tool: "orbit" | "pan";
  setTool: (t: "orbit" | "pan") => void;
  /** a brief the Earth console should open (set by a toast's View button) */
  focusBrief: { id: string; nonce: number } | null;
  openTarget: (t: NonNullable<Toast["target"]>) => void;
}

export type ToastLevel = "info" | "nominal" | "caution" | "warning";
export interface Toast {
  id: string; level: ToastLevel; title: string; detail?: string; ts: string; group?: string;
  /** "View" opens the panel this toast is about (and selects the brief) */
  target?: { panel: "crew" | "earth"; briefId?: string };
}

export const now = () => performance.now() / 1000;

export const useStore = create<State>((set) => ({
  spacecraft: null,
  earth: null,
  stats: null,
  mission: null,
  spaceWeather: null,
  online: false,
  demoFallback: false,
  lastUpdate: 0,

  view: "overview",
  viewNonce: 0,
  flights: [],
  outbox: [],
  earthQueue: [],

  setView: (view) => set((s) => ({ view, viewNonce: s.viewNonce + 1, autoView: false })),
  autoView: true,
  setAutoView: (autoView) => set({ autoView }),
  autoSetView: (view) => set((s) => ({ view, viewNonce: s.viewNonce + 1 })),

  toasts: [],
  unread: 0,
  logOpen: false,
  demoOpen: false,
  fresh: {},
  setLogOpen: (logOpen) => set(logOpen ? { logOpen, unread: 0 } : { logOpen }),
  setDemoOpen: (demoOpen) => set({ demoOpen }),
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  panels: { crew: true, earth: true },
  togglePanel: (p, show) => set((s) => {
    const panels = { ...s.panels, [p]: show ?? !s.panels[p] };
    try { localStorage.setItem("aegis.panels", JSON.stringify(panels)); } catch { /* private mode: not remembered */ }
    return { panels };
  }),
  setPanels: (panels) => set({ panels }),

  tool: "orbit",
  setTool: (tool) => set({ tool }),
  focusBrief: null,
  openTarget: (t) => {
    useStore.getState().togglePanel(t.panel, true);
    if (t.briefId) set((s) => ({ focusBrief: { id: t.briefId!, nonce: (s.focusBrief?.nonce ?? 0) + 1 } }));
  },
}));

/** Mark an item (brief id, reply id) as newly arrived for a few seconds. */
export function markFresh(id: string) {
  useStore.setState((s) => ({ fresh: { ...s.fresh, [id]: Date.now() } }));
}
export const isFresh = (fresh: Record<string, number>, id: string, ms = 6000) => Date.now() - (fresh[id] ?? 0) < ms;

// ---------------------------------------------------------------------------
// Snapshot tracker: turns sent_at / delivered_at into packet flights.
// ---------------------------------------------------------------------------

const ms = (iso?: string | null) => (iso ? Date.parse(iso) : NaN);

let animated: Set<string> | null = null; // ids we have already flown (or chose not to fly)
let launchCursor = 0;

export function resetTracker() {
  animated = null;
  launchCursor = 0;
  useStore.setState({ flights: [], outbox: [], earthQueue: [] });
}

type Leg = { id: string; kind: "bundle" | "reply"; layer?: Layer; sent: number; delivered: number };

function legOf(b: Bundle): Leg {
  return { id: b.bundle_id, kind: "bundle", layer: b.layer, sent: ms(b.sent_at), delivered: ms(b.delivered_at) };
}
function replyLeg(r: Reply): Leg {
  return { id: r.reply_id, kind: "reply", sent: ms(r.sent_at ?? r.created), delivered: ms(r.delivered_at) };
}

/** Schedule new flights. The real BPv7 hop is sub-second locally, so it is stretched to a readable
 *  minimum on screen; ordering and spacing follow the real sent_at values. */
function schedule(legs: Leg[]) {
  if (!legs.length) return;
  legs.sort((a, b) => a.sent - b.sent);
  const t0 = Math.max(now() + 0.1, launchCursor);
  const firstSent = legs[0].sent;
  const added: Flight[] = legs.map((l, i) => {
    const real = Number.isFinite(l.delivered) ? (l.delivered - l.sent) / 1000 : null;
    const offset = Math.max(i * LAUNCH_GAP_S, Number.isFinite(firstSent) ? (l.sent - firstSent) / 1000 : 0);
    const duration = Math.min(FLIGHT_MAX_S, Math.max(FLIGHT_MIN_S, real ?? 0));
    return { id: l.id, kind: l.kind, layer: l.layer, start: t0 + Math.min(offset, 4), duration, delivered: Number.isFinite(l.delivered), measuredS: real };
  });
  launchCursor = Math.max(...added.map((f) => f.start)) + LAUNCH_GAP_S;
  useStore.setState((s) => ({ flights: [...s.flights.filter((f) => !added.some((a) => a.id === f.id)), ...added] }));
}

export function ingestSnapshot(sc: SpacecraftState, earth: EarthState) {
  const first = animated === null;
  if (animated === null) animated = new Set();

  // Backend reset: forget animation history.
  if (!first && sc.outbox.length === 0 && useStore.getState().outbox.length + animated.size > 0 && (earth.briefs ?? []).length === 0) {
    resetTracker();
    animated = new Set();
  }

  const replies = earth.replies ?? [];
  const sentLegs = [
    ...sc.outbox.filter((b) => b.sent_at || b.status !== "queued").map(legOf),
    ...replies.filter((r) => r.sent_at || (r.status && r.status !== "queued")).map(replyLeg),
  ];
  const fresh: Leg[] = [];
  for (const leg of sentLegs) {
    if (animated.has(leg.id)) continue;
    animated.add(leg.id);
    // On page load, history is not replayed; afterwards anything newly sent flies.
    const recent = !Number.isFinite(leg.sent) || Date.now() - leg.sent < 20_000;
    if (!first && recent) fresh.push(leg);
  }
  schedule(fresh);

  // Update delivery flags and prune flights that have landed.
  const deliveredIds = new Set(sentLegs.filter((l) => Number.isFinite(l.delivered)).map((l) => l.id));
  const t = now();
  useStore.setState((s) => ({
    flights: s.flights
      .map((f) => (f.delivered || !deliveredIds.has(f.id) ? f : { ...f, delivered: true }))
      .filter((f) => !(f.delivered && t > f.start + f.duration + 0.5) && t < f.start + 60),
    outbox: sc.outbox.filter((b) => b.status === "queued" && !b.sent_at).map((b) => ({ id: b.bundle_id, layer: b.layer, size: b.size_bytes })),
    earthQueue: replies.filter((r) => r.status === "queued").map((r) => r.reply_id),
  }));
}

/** Is this bundle/reply still travelling on screen? (Panels wait for the marker to land.) */
export function isInFlight(flights: Flight[], id: string) {
  return flights.some((f) => f.id === id);
}

// ---------------------------------------------------------------------------
// Derived values
// ---------------------------------------------------------------------------

export function linkVisual(sc: SpacecraftState | null): LinkVisual {
  const state = sc?.link.state;
  return state === "window" ? "window" : state === "up" ? "up" : "down";
}

export function servingStation(mission: MissionState | null): StationId {
  const name = mission?.ground_station?.name?.toLowerCase() ?? "";
  const match = DSN_STATIONS.find((st) => name.includes(st.id));
  if (match) return match.id;
  // Fallback: the complex whose longitude is closest to the point under the spacecraft.
  const d = new Date();
  const hours = d.getUTCHours() + d.getUTCMinutes() / 60;
  const subLon = ((180 - hours * 15 + 540) % 360) - 180;
  let best: StationId = "goldstone";
  let bestDist = Infinity;
  for (const st of DSN_STATIONS) {
    const dist = Math.abs(((((st.lon - subLon) % 360) + 540) % 360) - 180);
    if (dist < bestDist) { bestDist = dist; best = st.id; }
  }
  return best;
}

export function oneWayDelayS(sc: SpacecraftState | null, mission: MissionState | null): number {
  if (mission?.spacecraft?.light_delay_s) return mission.spacecraft.light_delay_s;
  if (sc?.eta.one_way_delay_min) return sc.eta.one_way_delay_min * 60;
  return 14 * 60;
}
