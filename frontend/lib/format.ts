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
  m === "heart_rate" ? "Heart rate" : m === "spo2" ? "Blood oxygen" : m ? m.replace(/_/g, " ") : "Metric";

export const metricUnit = (m?: string) => (m === "heart_rate" ? "bpm" : m === "spo2" ? "%" : "");

export const feelingLabel = (f?: string | null) =>
  f === "fine" ? "Fine" : f === "a_bit_off" ? "A bit off" : f === "unwell" ? "Unwell" : "—";

export const timeHM = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())}`;
};
