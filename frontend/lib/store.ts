// Shared client state: the latest API snapshots plus the visual "story" derived from them
// (packets in flight, the outbox stack, link visual state, camera view, mission log).
import { create } from "zustand";
import type { EarthState, Layer, MissionState, SpacecraftState, Stats } from "./api";
import { DSN_STATIONS, FLIGHT_S, LAUNCH_GAP_S, WINDOW_VISUAL_S, type StationId } from "./constants";

export type CameraView = "overview" | "spacecraft" | "earth";
export type LinkVisual = "up" | "down" | "window";

export interface Flight {
  id: string;
  kind: "bundle" | "reply";
  layer?: Layer;
  /** seconds, performance.now() based */
  start: number;
  duration: number;
  /** index in the outbox stack it departs from (bundles only) */
  fromSlot: number;
}

export interface QueuedPacket { id: string; layer: Layer }
export interface LogEvent { id: string; ts: number; kind: string; text: string }

interface State {
  spacecraft: SpacecraftState | null;
  earth: EarthState | null;
  stats: Stats | null;
  mission: MissionState | null;
  online: boolean;
  lastUpdate: number;

  view: CameraView;
  viewNonce: number;
  windowUntil: number;
  flights: Flight[];
  outbox: QueuedPacket[];
  earthQueue: string[];
  log: LogEvent[];

  setView: (v: CameraView) => void;
  flashWindow: () => void;
}

export const now = () => performance.now() / 1000;

export const useStore = create<State>((set) => ({
  spacecraft: null,
  earth: null,
  stats: null,
  mission: null,
  online: false,
  lastUpdate: 0,

  view: "overview",
  viewNonce: 0,
  windowUntil: 0,
  flights: [],
  outbox: [],
  earthQueue: [],
  log: [],

  setView: (view) => set((s) => ({ view, viewNonce: s.viewNonce + 1 })),
  flashWindow: () => set({ windowUntil: now() + WINDOW_VISUAL_S }),
}));

// ---------------------------------------------------------------------------
// Snapshot tracker: turns status changes between polls into animations.
// ---------------------------------------------------------------------------

let prevBundles: Map<string, string> | null = null;
let prevReplies: Map<string, string> | null = null;
let prevLink: string | null = null;
let prevAlert: string | null = null;
let launchCursor = 0; // next free launch time, to keep packets spaced out
let logSeq = 0;

function pushLog(kind: string, text: string) {
  const ev: LogEvent = { id: `l${logSeq++}`, ts: Date.now(), kind, text };
  useStore.setState((s) => ({ log: [...s.log.slice(-40), ev] }));
}

function scheduleFlight(f: Omit<Flight, "start" | "duration">) {
  const t = Math.max(now() + 0.15, launchCursor);
  launchCursor = t + LAUNCH_GAP_S;
  const flight: Flight = { ...f, start: t, duration: FLIGHT_S };
  useStore.setState((s) => ({ flights: [...s.flights.filter((x) => x.id !== f.id), flight] }));
  // keep the flight ~0.6 s after landing for the arrival burst; the HUD reveals it after that
  const landInMs = (t + FLIGHT_S - now()) * 1000 + 600;
  window.setTimeout(() => {
    useStore.setState((s) => ({ flights: s.flights.filter((x) => x !== flight) }));
    if (f.kind === "bundle") pushLog("arrive", `${cap(f.layer ?? "layer")} layer received on Earth`);
    else pushLog("reply", "Reply from Earth received on board");
  }, landInMs);
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function resetTracker() {
  prevBundles = null;
  prevReplies = null;
  prevLink = null;
  prevAlert = null;
  launchCursor = 0;
  useStore.setState({ flights: [], outbox: [], earthQueue: [] });
}

export function ingestSnapshot(sc: SpacecraftState, earth: EarthState) {
  const first = prevBundles === null;
  const linkState = sc.link.state;

  // Backend reset (or a fresh DB): forget animation history.
  if (!first && sc.outbox.length === 0 && (prevBundles?.size ?? 0) > 0) {
    resetTracker();
    pushLog("system", "Mission reset");
  }

  const bundles = new Map(sc.outbox.map((b) => [b.bundle_id, b.status]));
  const queued = sc.outbox.filter((b) => b.status === "queued");
  const flightsBefore = new Set(useStore.getState().flights.map((f) => f.id));

  // Bundles that left the spacecraft since the last poll.
  let leftWhileDown = 0;
  if (prevBundles) {
    const oldQueue = useStore.getState().outbox;
    const departed = sc.outbox.filter(
      (b) => b.status !== "queued" && (prevBundles!.get(b.bundle_id) ?? "queued") === "queued",
    );
    departed.forEach((b) => {
      if (flightsBefore.has(b.bundle_id)) return;
      const slot = Math.max(0, oldQueue.findIndex((q) => q.id === b.bundle_id));
      scheduleFlight({ id: b.bundle_id, kind: "bundle", layer: b.layer, fromSlot: slot });
      if (linkState === "down") leftWhileDown++;
    });
    if (departed.length) pushLog("send", `${departed.length} bundle${departed.length > 1 ? "s" : ""} sent over BPv7`);
  }
  if (leftWhileDown > 0) {
    useStore.getState().flashWindow();
    pushLog("window", "Short contact window: headlines first");
  }

  // Replies: queued on Earth, then flying to the spacecraft.
  const replies = earth.replies ?? [];
  const nextReplies = new Map(replies.map((r) => [r.reply_id, r.status ?? "delivered"]));
  if (prevReplies) {
    replies.forEach((r) => {
      const st = r.status ?? "delivered";
      const before = prevReplies!.get(r.reply_id);
      if (before === undefined) pushLog("reply", "Earth medical team wrote a reply");
      if (st !== "queued" && (before ?? "queued") === "queued" && !flightsBefore.has(r.reply_id)) {
        scheduleFlight({ id: r.reply_id, kind: "reply", fromSlot: 0 });
      }
    });
  }

  // Log link and alert changes.
  if (prevLink !== null && prevLink !== linkState) {
    pushLog(linkState === "up" ? "link-up" : "link-down", linkState === "up" ? "Link restored · outbox flushing" : "Link lost · bundles held on board");
  }
  const alertId = sc.latest_alert?.alert_id ?? null;
  if (alertId && alertId !== prevAlert && prevAlert !== null) {
    pushLog("alert", `AEGIS ${sc.latest_alert!.severity}: ${sc.latest_alert!.metric.replace("_", " ")} ${Math.round(sc.latest_alert!.value)}`);
  }
  if (first) {
    pushLog("system", "Telemetry acquired");
    if (linkState === "down") pushLog("link-down", "Link is down · bundles held on board");
  }

  prevBundles = bundles;
  prevReplies = nextReplies;
  prevLink = linkState;
  prevAlert = alertId ?? "";

  useStore.setState({
    outbox: queued.map((b) => ({ id: b.bundle_id, layer: b.layer })),
    earthQueue: replies.filter((r) => r.status === "queued").map((r) => r.reply_id),
  });
}

/** Is this bundle/reply still travelling on screen? (HUD waits for the packet to land.) */
export function isInFlight(flights: Flight[], id: string) {
  return flights.some((f) => f.id === id);
}

// ---------------------------------------------------------------------------
// Derived values
// ---------------------------------------------------------------------------

export function linkVisual(s: Pick<State, "spacecraft" | "windowUntil">, t = now()): LinkVisual {
  if (t < s.windowUntil) return "window";
  return s.spacecraft?.link.state === "up" ? "up" : "down";
}

export function servingStation(mission: MissionState | null): StationId {
  const name = mission?.ground_station?.name?.toLowerCase() ?? "";
  const match = DSN_STATIONS.find((st) => name.includes(st.id));
  if (match) return match.id;
  // Fallback: the complex whose longitude is closest to the point under the spacecraft,
  // which sweeps west 15 degrees per hour as the Earth turns.
  const d = new Date();
  const hours = d.getUTCHours() + d.getUTCMinutes() / 60;
  const subLon = ((180 - hours * 15 + 540) % 360) - 180;
  let best: StationId = "goldstone";
  let bestDist = Infinity;
  for (const st of DSN_STATIONS) {
    const dist = Math.abs((((st.lon - subLon) % 360) + 540) % 360 - 180);
    if (dist < bestDist) { bestDist = dist; best = st.id; }
  }
  return best;
}

export function oneWayDelayS(sc: SpacecraftState | null, mission: MissionState | null): number {
  if (mission?.spacecraft?.light_delay_s) return mission.spacecraft.light_delay_s;
  if (sc?.eta.one_way_delay_min) return sc.eta.one_way_delay_min * 60;
  return 14 * 60;
}
