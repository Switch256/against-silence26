// Typed client for the AEGIS-MEDLINK backend (see ../openapi.json and HANDOFF.md).
// All requests go through the same-origin proxy defined in next.config.ts.
import { API_BASE } from "./config";

export type Layer = "headline" | "context" | "evidence";
export type Severity = "routine" | "review" | "urgent";
export type BundleStatus = "queued" | "in_transit" | "delivered";
export type Feeling = "fine" | "a_bit_off" | "unwell";
export type Scenario = "normal" | "spike" | "exercise" | "loose_watch" | "low_oxygen";

export interface Reading {
  ts: string;
  heart_rate: number;
  spo2: number | null;
  activity: string;
  signal_quality: string;
  source: string;
}

export interface Alert {
  alert_id: string;
  ts?: string;
  severity: Severity;
  metric: string;
  value: number;
  baseline: number | null;
  reason: string;
  todo: string[];
  done: string[];
}

export interface CheckIn {
  feeling: Feeling;
  symptom?: string | null;
}

export interface Bundle {
  bundle_id: string;
  brief_id: string;
  layer: Layer;
  severity: Severity;
  size_bytes: number;
  status: BundleStatus;
  /** when AEGIS queued the bundle on board */
  created?: string;
  /** handed to the BPv7 node (left the outbox) */
  sent_at?: string | null;
  /** seen arriving on Earth */
  delivered_at?: string | null;
}

export interface Reply {
  reply_id: string;
  brief_id: string;
  text: string;
  author: string;
  created?: string;
  status?: BundleStatus;
  sent_at?: string | null;
  delivered_at?: string | null;
}

export interface Eta {
  link_up: boolean;
  earth_sees_in_min: number;
  earliest_reply_in_min: number;
  one_way_delay_min?: number;
}

export interface SpacecraftState {
  astronaut_id: string;
  readings: Reading[];
  latest_alert: Alert | null;
  alerts?: Alert[];
  checkin: CheckIn | null;
  outbox: Bundle[];
  link: { state: "up" | "down" | "window"; bytes_sent: number; window_until?: string | null };
  eta: Eta;
  replies: Reply[];
  transport?: string;
}

export type SpaceWeatherLevel = "nominal" | "info" | "caution" | "warning";
export interface SpaceWeatherEvent {
  event_id: string; kind: "SEP" | "CME" | "GST" | "RBE" | string; start_time: string;
  severity: string; summary: string; link?: string | null; origin?: string;
}
/** GET /api/space-weather: NASA DONKI (real data, live or the May 2024 replay). */
export interface SpaceWeather {
  level: SpaceWeatherLevel; headline: string; active: SpaceWeatherEvent[]; recent: SpaceWeatherEvent[];
  todo: string[]; source: string; note?: string; mode: "live" | "replay"; as_of?: string;
}
export interface SpaceWeatherBrief { level?: SpaceWeatherLevel; headline?: string; source?: string; mode?: "live" | "replay" }

export interface Headline { a?: string; m?: string; val?: number; base?: number; sev?: Severity; sq?: string; id?: string }
export interface Context {
  reason?: string; activity?: string; spo2?: number | null;
  checkin?: CheckIn | null; done?: string[]; todo?: string[]; simulated?: boolean;
  space_weather?: SpaceWeatherBrief | null;
}
export interface Evidence { unit?: string; hr?: [number, number][] }

export interface Brief {
  brief_id: string;
  layers: { headline?: Headline; context?: Context; evidence?: Evidence };
  first_received?: string;
}

export interface EarthState {
  briefs: Brief[];
  replies: Reply[];
}

export interface Stats {
  queued: number;
  in_transit: number;
  delivered: number;
  briefs: number;
  bytes_sent: number;
  readings: number;
  transport: string;
  raw_bytes_equivalent: number;
}

export interface MissionEvent {
  id?: number;
  ts: string;
  kind: string;
  text: string;
  data?: { brief_id?: string; bundle_id?: string; reply_id?: string; [k: string]: unknown } | null;
}

/** BPv7 node counters as reported by dtn7-rs (null in local mode). */
export interface NodeCounters { incoming?: number; outgoing?: number; delivered?: number; failed?: number; dups?: number; broken?: number }

/** GET /api/mission (optional: newer backends only). */
export interface MissionState {
  mission_time_s?: number;
  spacecraft?: { name?: string; distance_km?: number; light_delay_s?: number; phase?: string };
  link?: { state?: string; window_until?: string | null };
  ground_station?: { name?: string; lat?: number; lon?: number };
  bpv7?: { spacecraft?: NodeCounters | null; earth?: NodeCounters | null; reachable?: boolean } | null;
  events?: MissionEvent[];
  space_weather?: SpaceWeatherBrief | null;
}

/** Crew record (GET /api/crew*). The crew is FICTIONAL; only the monitored member has telemetry. */
export interface CrewProfile {
  astronaut_id: string; name: string; sex?: string; age?: number; nationality?: string; country_code?: string;
  role?: string; height_cm?: number; mass_kg?: number; blood_type?: string; allergies?: string; medications?: string;
  monitored: boolean; sensor?: string; sampling?: string; mission?: string; simulated?: boolean; fictional?: boolean;
}
export interface CrewSummary {
  profile: CrewProfile;
  crew: CrewProfile[];
  baseline: { heart_rate_rest: number | null; spo2_rest: number | null; window: string };
  record: { readings: number; first: string | null; last: string | null; alerts: Partial<Record<Severity, number>>; last_checkin: { ts: string; feeling: string; symptom: string | null } | null };
}
/** One row of the history: a raw reading, or (step_s > 0) the average of a time bucket. */
export interface HistoryRow {
  ts: string; heart_rate: number; spo2: number | null; activity: string;
  signal_quality?: string; source?: string;
  heart_rate_min?: number; heart_rate_max?: number; spo2_min?: number | null; samples?: number; poor_signal?: number;
}
export interface HistoryAlert { ts: string; alert_id: string; metric: string; value: number; baseline: number | null; severity: Severity; reason: string }
export interface CrewHistory {
  total_readings: number; step_s: number; readings: HistoryRow[]; alerts: HistoryAlert[];
  checkins: { ts: string; feeling: string; symptom: string | null }[]; next_before: string | null;
}
export type ExportDataset = "readings" | "alerts" | "checkins" | "all";

const qs = (o: Record<string, string | number | undefined | null>) =>
  Object.entries(o).filter(([, v]) => v != null && v !== "").map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join("&");

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
    signal,
  });
  if (!res.ok) throw new ApiError(res.status, `${path}: ${res.status}`);
  return res.json() as Promise<T>;
}

export const api = {
  spacecraft: (s?: AbortSignal) => request<SpacecraftState>("/api/spacecraft", undefined, s),
  earth: (s?: AbortSignal) => request<EarthState>("/api/earth", undefined, s),
  stats: (s?: AbortSignal) => request<Stats>("/api/stats", undefined, s),
  mission: (s?: AbortSignal) => request<MissionState>("/api/mission", undefined, s),
  spaceWeather: (s?: AbortSignal) => request<SpaceWeather>("/api/space-weather", undefined, s),
  spaceWeatherReplay: (scenario: "may-2024" | "live") => request("/api/space-weather/replay", { scenario }),

  simStep: (scenario: Scenario, count: number, force = false) => request("/api/sim/step", { scenario, count, force }),
  checkin: (feeling: Feeling, symptom: string | null) => request("/api/checkin", { feeling, symptom }),
  escalate: (reason: "no_response" | "crew_request") => request("/api/escalate", { reason }),
  markDone: (alertId: string, step: string) =>
    request(`/api/alerts/${encodeURIComponent(alertId)}/done`, { step }),
  setLink: (state: "up" | "down") => request("/api/link", { state }),
  openWindow: (budget_bytes = 250, duration_s = 8) => request("/api/link/window", { budget_bytes, duration_s }),
  reply: (brief_id: string, text: string) => request("/api/earth/reply", { brief_id, text }),
  reset: () => request("/api/reset", {}),

  crew: (s?: AbortSignal) => request<CrewSummary>("/api/crew", undefined, s),
  crewHistory: (p: { start?: string; step_s?: number; limit?: number; before?: string | null }, s?: AbortSignal) =>
    request<CrewHistory>(`/api/crew/history?${qs(p)}`, undefined, s),
  /** URL of a download (served with Content-Disposition: attachment). */
  crewExportUrl: (dataset: ExportDataset, format: "csv" | "json", start?: string) =>
    `${API_BASE}/api/crew/export?${qs({ dataset, format, start })}`,
};
