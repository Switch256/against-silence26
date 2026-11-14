"use client";
import { useEffect, useMemo, useRef } from "react";
import type { Reading } from "@/lib/api";
import { useStore } from "@/lib/store";
import { ActivityIcon, HeartIcon, SignalIcon } from "./icons";
import { Panel } from "./Panel";

/** One PQRST complex, x in [0,1) of a beat -> amplitude. */
function ecg(x: number) {
  const g = (mu: number, sig: number, a: number) => a * Math.exp(-((x - mu) ** 2) / (2 * sig * sig));
  return g(0.18, 0.025, 0.12) + g(0.3, 0.008, -0.12) + g(0.33, 0.01, 1) + g(0.36, 0.01, -0.25) + g(0.58, 0.045, 0.28);
}

/** Monitor-style sweeping ECG trace whose beat rate follows the live heart rate. */
function EcgTrace({ bpm, color }: { bpm: number; color: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const bpmRef = useRef(bpm);
  bpmRef.current = bpm;

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    let raf = 0;
    let phase = 0;
    let x = 0;
    let lastY = 0;
    let last = performance.now();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const resize = () => {
      c.width = c.clientWidth * dpr;
      c.height = c.clientHeight * dpr;
      ctx.fillStyle = "rgba(0,0,0,0)";
      ctx.clearRect(0, 0, c.width, c.height);
    };
    resize();
    const speed = 90; // px per second (css)
    const draw = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const w = c.width;
      const h = c.height;
      const steps = Math.max(1, Math.round(speed * dt * dpr));
      ctx.lineWidth = 1.8 * dpr;
      ctx.strokeStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 6 * dpr;
      for (let i = 0; i < steps; i++) {
        phase += (bpmRef.current / 60) * (dt / steps);
        const y = h * 0.72 - ecg(phase % 1) * h * 0.58 + Math.sin(now * 0.0013) * 1.2 * dpr;
        ctx.clearRect(x, 0, 14 * dpr, h); // erase bar ahead of the pen
        ctx.beginPath();
        ctx.moveTo(x, lastY || y);
        ctx.lineTo(x + 1, y);
        ctx.stroke();
        lastY = y;
        x += 1;
        if (x >= w) {
          x = 0;
          lastY = 0;
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [color]);

  return <canvas ref={canvas} className="h-[50px] w-full" />;
}

function Trend({ readings }: { readings: Reading[] }) {
  const { path, area, base } = useMemo(() => {
    const hr = readings.map((r) => r.heart_rate);
    if (hr.length < 2) return { path: "", area: "", base: 0 };
    const lo = Math.min(50, ...hr);
    const hi = Math.max(130, ...hr);
    const W = 300;
    const H = 40;
    const pts = hr.map((v, i) => [(i / (hr.length - 1)) * W, H - ((v - lo) / (hi - lo)) * (H - 4) - 2]);
    const path = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join("");
    const sorted = [...hr].sort((a, b) => a - b);
    const med = sorted[Math.floor(sorted.length / 2)];
    return { path, area: `${path}L${W},${H}L0,${H}Z`, base: H - ((med - lo) / (hi - lo)) * (H - 4) - 2 };
  }, [readings]);
  if (!path) return <div className="h-10" />;
  return (
    <svg viewBox="0 0 300 40" preserveAspectRatio="none" className="h-10 w-full">
      <defs>
        <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#38e1ff" stopOpacity="0.28" />
          <stop offset="1" stopColor="#38e1ff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <line x1="0" x2="300" y1={base} y2={base} stroke="#8aa0bd" strokeOpacity="0.35" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />
      <path d={area} fill="url(#trendFill)" />
      <path d={path} fill="none" stroke="#38e1ff" strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function SpO2Ring({ value }: { value: number | null }) {
  const v = value ?? 0;
  const frac = Math.max(0, Math.min(1, (v - 80) / 20));
  const C = 2 * Math.PI * 15;
  const color = v === 0 ? "#4f6582" : v < 92 ? "#ff3b4f" : v < 95 ? "#ffb020" : "#2fe39a";
  return (
    <div className="flex items-center gap-2.5">
      <svg viewBox="0 0 36 36" className="h-10 w-10 -rotate-90">
        <circle cx="18" cy="18" r="15" stroke="rgba(130,200,255,0.12)" strokeWidth="3" fill="none" />
        <circle
          cx="18" cy="18" r="15" stroke={color} strokeWidth="3" fill="none" strokeLinecap="round"
          strokeDasharray={`${C * frac} ${C}`} style={{ transition: "stroke-dasharray .6s, stroke .6s", filter: `drop-shadow(0 0 3px ${color})` }}
        />
      </svg>
      <div className="leading-tight">
        <div className="label !text-[9px]">SpO₂</div>
        <div className="font-mono text-[18px] tabular-nums">{value != null ? value.toFixed(0) : "–"}<span className="text-[11px] text-dim">%</span></div>
      </div>
    </div>
  );
}

export function VitalsPanel() {
  const sc = useStore((s) => s.spacecraft);
  const last = sc?.readings.at(-1);
  const hr = last?.heart_rate ?? 0;
  const alert = sc?.latest_alert;
  const recentAlert = !!alert && alert.metric === "heart_rate" && !!last && alert.baseline != null && Math.abs(hr - alert.baseline) > 12;
  const hrColor = !last ? "#4f6582" : recentAlert ? (alert!.severity === "urgent" ? "#ff3b4f" : "#ffb020") : "#2fe39a";
  const sq = last?.signal_quality ?? "–";
  const sqLevel = sq === "good" ? 4 : sq === "fair" ? 2 : sq === "poor" ? 1 : 0;

  return (
    <Panel
      title="Crew vitals"
      kicker={sc?.astronaut_id ?? "crew-01"}
      right={
        <span className="shrink-0 rounded border border-amber/50 px-1.5 py-0.5 font-mono text-[9px] tracking-[0.16em] whitespace-nowrap text-amber">
          SIMULATED DATA
        </span>
      }
    >
      <div className="flex items-end justify-between">
        <div className="flex items-end gap-2">
          <span className="font-mono text-[52px] leading-[0.9] font-medium tabular-nums transition-colors duration-500" style={{ color: hrColor, textShadow: `0 0 24px ${hrColor}55` }}>
            {last ? Math.round(hr) : "––"}
          </span>
          <div className="mb-1 flex flex-col items-start">
            <HeartIcon className="h-4 w-4 glow-pulse" />
            <span className="font-mono text-[11px] text-dim">bpm</span>
          </div>
        </div>
        <div className="mb-1 text-right">
          <div className="label !text-[9px]">Heart rate</div>
          <div className="font-mono text-[10px] text-faint">{sc ? `${sc.readings.length} readings` : "no telemetry"}</div>
        </div>
      </div>
      <div className="relative mt-2 overflow-hidden rounded-lg border border-white/5 bg-black/25">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{ backgroundImage: "linear-gradient(rgba(47,227,154,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(47,227,154,0.08) 1px, transparent 1px)", backgroundSize: "12px 12px" }}
        />
        <EcgTrace bpm={last ? hr : 0.0001} color={hrColor} />
      </div>
      <div className="mt-2">
        <div className="mb-0.5 flex justify-between font-mono text-[9px] text-faint">
          <span>HR trend · last {sc?.readings.length ?? 0}</span>
          <span>– – baseline</span>
        </div>
        <Trend readings={sc?.readings ?? []} />
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 border-t border-white/5 pt-2.5">
        <SpO2Ring value={last?.spo2 ?? null} />
        <div className="flex items-center gap-2">
          <ActivityIcon className="h-5 w-5 text-link" />
          <div className="leading-tight">
            <div className="label !text-[9px]">Activity</div>
            <div className="text-[13px] capitalize">{last?.activity?.replace("_", " ") ?? "–"}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <SignalIcon level={sqLevel} className={`h-5 w-5 ${sqLevel >= 3 ? "text-reply" : sqLevel >= 2 ? "text-amber" : "text-lost"}`} />
          <div className="leading-tight">
            <div className="label !text-[9px]">Sensor</div>
            <div className="text-[13px] capitalize">{sq}</div>
          </div>
        </div>
      </div>
    </Panel>
  );
}
