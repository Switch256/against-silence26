import type { Layer } from "./api";

/** NASA Deep Space Network complexes (real coordinates). */
export const DSN_STATIONS = [
  { id: "goldstone", name: "Goldstone", place: "California, USA", lat: 35.43, lon: -116.89 },
  { id: "madrid", name: "Madrid", place: "Robledo, Spain", lat: 40.43, lon: -4.25 },
  { id: "canberra", name: "Canberra", place: "Tidbinbilla, Australia", lat: -35.4, lon: 148.98 },
] as const;
export type StationId = (typeof DSN_STATIONS)[number]["id"];

export const COLORS = {
  link: "#38e1ff",
  linkDown: "#ff3b4f",
  window: "#ffb020",
  headline: "#ff3b4f",
  context: "#ff8a1f",
  evidence: "#3d8bff",
  reply: "#2fe39a",
  urgent: "#ff3b4f",
  review: "#ffb020",
  routine: "#3d8bff",
} as const;

export const LAYER_ORDER: Layer[] = ["headline", "context", "evidence"];
export const LAYER_LABEL: Record<Layer, string> = { headline: "Headline", context: "Context", evidence: "Evidence" };

/** Seconds a packet takes to cross the beam on screen (the real light delay is compressed). */
export const FLIGHT_S = 3.4;
/** Gap between consecutive packets leaving the spacecraft. */
export const LAUNCH_GAP_S = 0.55;
/** How long the amber "short window" beam stays on after a window is detected. */
export const WINDOW_VISUAL_S = 6;

export const FALLBACK_SPACECRAFT_NAME = "MTV-1 Odyssey";
export const FALLBACK_DELAY_MIN = 14;
