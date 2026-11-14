export const fmtBytes = (b: number) =>
  b >= 1_000_000 ? `${(b / 1_000_000).toFixed(1)} MB` : b >= 1000 ? `${(b / 1000).toFixed(1)} KB` : `${Math.round(b)} B`;

export const pad2 = (n: number) => String(Math.floor(n)).padStart(2, "0");

export function fmtDuration(s: number) {
  s = Math.max(0, Math.floor(s));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return d > 0 ? `${d}d ${pad2(h)}:${pad2(m)}:${pad2(sec)}` : `${pad2(h)}:${pad2(m)}:${pad2(sec)}`;
}

export const metricLabel = (m?: string) =>
  m === "heart_rate" ? "Heart rate" : m === "spo2" ? "Blood oxygen (SpO₂)" : m === "space_weather" ? "Space weather" : m === "crew_check" ? "Crew check" : m ? m.replace(/_/g, " ") : "Metric";

export const metricUnit = (m?: string) => (m === "heart_rate" || m === "crew_check" ? "bpm" : m === "spo2" ? "%" : "");

/** Value as shown to the crew / doctor, e.g. "112 bpm", "89 %", "2 solar particle events". */
export function metricValue(m: string | undefined, v: number | null | undefined) {
  if (v == null) return "–";
  if (m === "space_weather") return `${Math.round(v)} SEP event${Math.round(v) === 1 ? "" : "s"}`;
  return `${Math.round(v)}`;
}

/** Time of day in UTC with seconds, e.g. 14:53:48. */
export const utc = (iso?: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())}`;
};
/** UTC date + time, e.g. 10 May 2024 17:00 */
export const utcDate = (iso?: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const mon = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][d.getUTCMonth()];
  return `${d.getUTCDate()} ${mon} ${d.getUTCFullYear()} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
};

export const feelingLabel = (f?: string | null) =>
  f === "fine" ? "Fine" : f === "a_bit_off" ? "A bit off" : f === "unwell" ? "Unwell" : "—";

export const timeHM = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())}`;
};

/** AEGIS alert id -> PulseBrief id (al-xxxx -> pb-xxxx). */
export const briefIdOf = (alertId: string) => alertId.replace(/^al-/, "pb-");

/** UTC time with tenths of a second, e.g. 14:53:48.7 (for sub-second BPv7 hops). */
export const utcTenths = (iso?: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : `${utc(iso)}.${Math.floor(d.getUTCMilliseconds() / 100)}`;
};

/** Seconds between two ISO timestamps, formatted ("0.34 s", "12 s", "3 min 05 s"). */
export function fmtSpan(a?: string | null, b?: string | null) {
  if (!a || !b) return "—";
  const s = (Date.parse(b) - Date.parse(a)) / 1000;
  if (!Number.isFinite(s)) return "—";
  if (s < 10) return `${s.toFixed(2)} s`;
  if (s < 120) return `${Math.round(s)} s`;
  return `${Math.floor(s / 60)} min ${pad2(s % 60)} s`;
}
