"use client";
// Evidence layer: heart rate around the event (seconds from the event), with the personal baseline.
import { useMemo } from "react";
import type { Evidence } from "@/lib/api";
import { COLORS } from "@/lib/constants";

const W = 340;
const H = 84;
const PAD = { l: 28, r: 6, t: 6, b: 16 };

export function EvidenceChart({ ev, base }: { ev: Evidence; base?: number }) {
  const data = ev.hr ?? [];
  const g = useMemo(() => {
    if (data.length < 2) return null;
    const xs = data.map((d) => d[0]);
    const ys = data.map((d) => d[1]);
    const x0 = Math.min(...xs);
    const x1 = Math.max(...xs, 1);
    const lo = Math.floor((Math.min(...ys, base ?? Infinity) - 6) / 10) * 10;
    const hi = Math.ceil((Math.max(...ys) + 6) / 10) * 10;
    const X = (x: number) => PAD.l + ((x - x0) / (x1 - x0)) * (W - PAD.l - PAD.r);
    const Y = (y: number) => PAD.t + (1 - (y - lo) / (hi - lo)) * (H - PAD.t - PAD.b);
    const path = data.map(([x, y], i) => `${i ? "L" : "M"}${X(x).toFixed(1)},${Y(y).toFixed(1)}`).join("");
    const ticks = [lo, Math.round((lo + hi) / 2), hi];
    return { path, X, Y, x0, x1, ticks, by: base != null ? Y(base) : null };
  }, [data, base]);
  if (!g) return null;
  return (
    <figure className="enter">
      <figcaption className="mb-1 flex justify-between text-[11px] text-fg-3">
        <span>Heart rate around the event ({ev.unit ?? "bpm"})</span>
        <span className="num">{data.length} samples</span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Heart rate around the event">
        {g.ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={g.Y(t)} y2={g.Y(t)} stroke={COLORS.line} />
            <text x={PAD.l - 5} y={g.Y(t) + 3} textAnchor="end" fontSize="9" fill={COLORS.fg4} className="num">{t}</text>
          </g>
        ))}
        {g.by != null && <line x1={PAD.l} x2={W - PAD.r} y1={g.by} y2={g.by} stroke={COLORS.fg3} strokeDasharray="4 4" />}
        <line x1={g.X(0)} x2={g.X(0)} y1={PAD.t} y2={H - PAD.b} stroke={COLORS.fg3} />
        <path d={g.path} fill="none" stroke={COLORS.fg} strokeWidth="1.4" strokeLinejoin="round" />
        <text x={PAD.l} y={H - 3} fontSize="9" fill={COLORS.fg4}>{Math.round(g.x0)} s</text>
        <text x={g.X(0)} y={H - 3} fontSize="9" fill={COLORS.fg3} textAnchor="middle">event</text>
        <text x={W - PAD.r} y={H - 3} fontSize="9" fill={COLORS.fg4} textAnchor="end">+{Math.round(g.x1)} s</text>
      </svg>
      <div className="mt-0.5 text-[11px] text-fg-4">– – personal baseline</div>
    </figure>
  );
}
