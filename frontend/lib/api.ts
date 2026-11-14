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
  created?: string;
  delivered_at?: string | null;
}

export interface Reply {
  reply_id: string;
  brief_id: string;
  text: string;
  author: string;
  created?: string;
  status?: BundleStatus;
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
  link: { state: "up" | "down"; bytes_sent: number };
  eta: Eta;
  replies: Reply[];
  transport?: string;
}

export interface Headline { a?: string; m?: string; val?: number; base?: number; sev?: Severity; sq?: string; id?: string }
export interface Context {
  reason?: string; activity?: string; spo2?: number | null;
  checkin?: CheckIn | null; done?: string[]; simulated?: boolean;
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

export interface MissionEvent { ts: string; kind: string; text: string }

/** GET /api/mission (optional: newer backends only). */
export interface MissionState {
  mission_time_s?: number;
  spacecraft?: { name?: string; distance_km?: number; light_delay_s?: number; phase?: string };
  link?: { state?: string };
  ground_station?: { name?: string; lat?: number; lon?: number };
  bpv7?: Record<string, Record<string, unknown>> | null;
  events?: MissionEvent[];
}

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

  simStep: (scenario: Scenario, count: number) => request("/api/sim/step", { scenario, count }),
  checkin: (feeling: Feeling, symptom: string | null) => request("/api/checkin", { feeling, symptom }),
  markDone: (alertId: string, step: string) =>
    request(`/api/alerts/${encodeURIComponent(alertId)}/done`, { step }),
  setLink: (state: "up" | "down") => request("/api/link", { state }),
  openWindow: (budget_bytes = 250) => request("/api/link/window", { budget_bytes }),
  reply: (brief_id: string, text: string) => request("/api/earth/reply", { brief_id, text }),
  reset: () => request("/api/reset", {}),
};
