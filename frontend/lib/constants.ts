import type { Layer, Severity } from "./api";

/** NASA Deep Space Network complexes (real coordinates) and a representative 34 m antenna at each. */
export const DSN_STATIONS = [
  { id: "goldstone", name: "Goldstone", place: "California, USA", antenna: "DSS-26", lat: 35.43, lon: -116.89 },
  { id: "madrid", name: "Madrid", place: "Robledo de Chavela, Spain", antenna: "DSS-54", lat: 40.43, lon: -4.25 },
  { id: "canberra", name: "Canberra", place: "Tidbinbilla, Australia", antenna: "DSS-35", lat: -35.4, lon: 148.98 },
] as const;
export type StationId = (typeof DSN_STATIONS)[number]["id"];

/**
 * Colour is reserved for meaning (NASA-STD-3001 Vol 2, Appendix F).
 * Keep in sync with the @theme tokens in app/globals.css.
 */
export const COLORS = {
  accent: "#6aa8f0",
  nominal: "#3fbf7f",
  caution: "#f0b429",
  warning: "#ff6b5b",
  fg: "#e8eaeb",
  fg2: "#b4b9bc",
  fg3: "#858c90",
  fg4: "#5c6468",
  line: "#262d31",
  lineStrong: "#3a4246",
} as const;

/** AEGIS severity -> caution & warning class. "routine" is advisory (no status colour). */
export const SEVERITY = {
  urgent: { label: "Warning", color: COLORS.warning },
  review: { label: "Caution", color: COLORS.caution },
  routine: { label: "Advisory", color: COLORS.fg2 },
} as const satisfies Record<Severity, { label: string; color: string }>;

export const LAYER_ORDER: Layer[] = ["headline", "context", "evidence"];
export const LAYER_LABEL: Record<Layer, string> = { headline: "Headline", context: "Context", evidence: "Evidence" };

/** Shortest / longest time a packet marker takes to cross the link on screen (seconds). */
export const FLIGHT_MIN_S = 2.6;
export const FLIGHT_MAX_S = 8;
/** Minimum gap between consecutive packets leaving the spacecraft. */
export const LAUNCH_GAP_S = 0.45;

export const FALLBACK_SPACECRAFT_NAME = "AEGIS-1";
