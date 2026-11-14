"use client";
// Heart rate: large numeral, personal baseline, deviation and a trace of recent readings.
import { useMemo } from "react";
import type { Reading } from "@/lib/api";
import { COLORS } from "@/lib/constants";
import { STATUS_COLOR, type StatusLevel } from "@/components/ui/Status";
import { EcgTrace } from "./EcgTrace";

export function median(xs: number[]) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

function Trace({ values, baseline, color }: { values: number[]; baseline: number | null; color: string }) {
  const W = 320;
  const H = 24;
  const g = useMemo(() => {
    if (values.length < 2) return null;
    const lo = Math.min(55, ...values, baseline ?? 999) - 4;
    const hi = Math.max(110, ...values) + 4;
    const y = (v: number) => H - ((v - lo) / (hi - lo)) * H;
    const path = values.map((v, i) => `${i ? "L" : "M"}${((i / (values.length - 1)) * W).toFixed(1)},${y(v).toFixed(1)}`).join("");
    return { path, by: baseline != null ? y(baseline) : null, lo, hi };
  }, [values, baseline]);
  if (!g) return <div className="flex h-6 items-center text-[12px] text-fg-4">Waiting for readings</div>;
  return (
    <div className="relative" title={`range ${Math.round(g.lo)}–${Math.round(g.hi)} bpm`}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-6 w-full">
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1="0" x2={W} y1={H * f} y2={H * f} stroke={COLORS.line} vectorEffect="non-scaling-stroke" />
        ))}
        {g.by != null && <line x1="0" x2={W} y1={g.by} y2={g.by} stroke={COLORS.fg3} strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />}
        <path d={g.path} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

interface Props {
  readings: Reading[];
  /** AEGIS's personal baseline from a recent alert, if any */
  alertBaseline: number | null;
}

/** Colour follows the CURRENT reading against the personal baseline (display only; AEGIS decides alerts). */
export function levelOf(hr: number | undefined, baseline: number | null, activity?: string): StatusLevel {
  if (hr == null) return "neutral";
  if (hr >= 140 || hr <= 40) return "warning";
  if (baseline == null || activity === "exercise") return "neutral";
  const d = Math.abs(hr - baseline);
  return d >= 30 ? "warning" : d >= 15 ? "caution" : "neutral";
}

export function HeartRate({ readings, alertBaseline }: Props) {
  const last = readings.at(-1);
  const values = readings.slice(-120).map((r) => r.heart_rate);
  const baseline = alertBaseline ?? median(readings.filter((r) => r.activity === "rest").slice(0, 60).map((r) => r.heart_rate));
  const hr = last?.heart_rate;
  const delta = hr != null && baseline != null ? hr - baseline : null;
  const level = levelOf(hr, baseline, last?.activity);
  const valueColor = level === "caution" || level === "warning" ? STATUS_COLOR[level] : COLORS.fg;
  const traceColor = level === "caution" || level === "warning" ? STATUS_COLOR[level] : COLORS.fg2;

  return (
    <div>
      <div className="flex items-end gap-4">
        <div className="flex items-baseline gap-1.5">
          <span className="num text-[34px] leading-none font-semibold tracking-[-0.02em]" style={{ color: valueColor }}>
            {hr != null ? Math.round(hr) : "––"}
          </span>
          <span className="text-[12px] text-fg-3">bpm</span>
        </div>
        <dl className="num mb-0.5 grid grid-cols-[auto_auto] gap-x-3 text-[11px] leading-4">
          <dt className="text-fg-3">Baseline</dt>
          <dd className="text-fg-2">{baseline != null ? `${Math.round(baseline)} bpm` : "—"}</dd>
          <dt className="text-fg-3">Deviation</dt>
          <dd style={{ color: valueColor === COLORS.fg ? COLORS.fg2 : valueColor }}>
            {delta != null ? (Math.round(delta) === 0 ? "0 bpm" : `${delta > 0 ? "+" : "−"}${Math.abs(Math.round(delta))} bpm`) : "—"}
          </dd>
        </dl>
      </div>
      <div className="mt-1.5 rounded-lg bg-sunken px-1.5 pt-1">
        <div className="flex items-center justify-between text-[10px] text-fg-4">
          <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: traceColor }} /> ECG · live · simulated</span>
          <span className="num">{hr != null ? `${Math.round(hr)} bpm` : ""}</span>
        </div>
        <EcgTrace hr={hr ?? null} color={valueColor === COLORS.fg ? "#7fd1a8" : valueColor} />
      </div>
      <div className="mt-1" title={`Trend: last ${values.length} readings · dashed line: personal baseline`}>
        <Trace values={values} baseline={baseline} color={traceColor} />
      </div>
    </div>
  );
}
