// Status vocabulary shared by every panel (NASA-STD-3001 Vol 2 Appendix F):
// colour is only ever nominal / caution / warning, and always paired with a word and a shape.
import type { ReactNode } from "react";
import { COLORS } from "@/lib/constants";
import { AlertTriangle } from "./icons";

export type StatusLevel = "nominal" | "caution" | "warning" | "neutral" | "accent";

export const STATUS_COLOR: Record<StatusLevel, string> = {
  nominal: COLORS.nominal,
  caution: COLORS.caution,
  warning: COLORS.warning,
  neutral: COLORS.fg3,
  accent: COLORS.accent,
};

/** Small status mark: a dot for nominal/neutral, a triangle for caution/warning. */
export function StatusMark({ level, className = "h-3.5 w-3.5" }: { level: StatusLevel; className?: string }) {
  const color = STATUS_COLOR[level];
  if (level === "caution" || level === "warning") return <AlertTriangle className={`${className} shrink-0`} />;
  return (
    <span className="flex shrink-0 items-center justify-center" style={{ width: 14, height: 14 }}>
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
    </span>
  );
}

/** Inline status: mark + text in the status colour. */
export function StatusText({ level, children, className = "" }: { level: StatusLevel; children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 font-medium ${className}`} style={{ color: STATUS_COLOR[level] }}>
      <StatusMark level={level} />
      {children}
    </span>
  );
}

/** Where a value comes from. Real NASA data and simulated data are never mixed up. */
export type Provenance = "simulated" | "nasa-derived" | "measured" | "nasa-donki";
const PROV_LABEL: Record<Provenance, string> = {
  simulated: "Simulated",
  "nasa-derived": "NASA-derived",
  measured: "Measured",
  "nasa-donki": "NASA DONKI",
};
export function ProvenanceTag({ value, title }: { value: Provenance; title?: string }) {
  const real = value !== "simulated";
  return (
    <span className="tag" title={title} style={real ? { color: COLORS.fg2, borderColor: "#4c565b" } : undefined}>
      {PROV_LABEL[value]}
    </span>
  );
}

export function provenanceOf(source?: string): Provenance {
  const s = (source ?? "").toLowerCase();
  if (s.includes("nasa")) return "nasa-derived";
  if (s.includes("wearable") || s.includes("device") || s.includes("sensor")) return "measured";
  return "simulated";
}
