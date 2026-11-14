"use client";
// Live ECG-style trace (simulated): a monitor sweep drawn at the current heart rate.
// The waveform is a synthetic PQRST template, not a measured ECG; the rate follows live telemetry.
import { useEffect, useRef } from "react";

const WINDOW_S = 4;            // seconds of trace across the width
const GAP_PX = 14;             // erase bar ahead of the sweep, like a bedside monitor

const g = (x: number, mu: number, s: number) => Math.exp(-((x - mu) ** 2) / (2 * s * s));
/** one heartbeat, phase 0..1 -> amplitude (R peak = 1) */
function pqrst(p: number) {
  return 0.1 * g(p, 0.18, 0.025) - 0.12 * g(p, 0.355, 0.01) + 1.0 * g(p, 0.38, 0.011)
    - 0.24 * g(p, 0.405, 0.012) + 0.28 * g(p, 0.62, 0.045);
}

export function EcgTrace({ hr, color }: { hr: number | null; color: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const hrRef = useRef(hr);
  const colorRef = useRef(color);
  hrRef.current = hr;
  colorRef.current = color;

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const ctx = el.getContext("2d")!;
    let raf = 0;
    let w = 0, h = 0, dpr = 1;
    let ys: Float32Array = new Float32Array(0);
    let x = 0, phase = 0, last = performance.now();

    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = el.clientWidth; h = el.clientHeight;
      el.width = Math.round(w * dpr); el.height = Math.round(h * dpr);
      ys = new Float32Array(Math.max(1, Math.round(w))).fill(NaN);
      x = 0;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);

    const frame = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const bpm = hrRef.current;
      const pxPerS = w / WINDOW_S;
      const steps = Math.max(1, Math.round(pxPerS * dt));
      for (let i = 0; i < steps; i++) {
        if (bpm) phase = (phase + (bpm / 60) * (dt / steps)) % 1;
        const amp = bpm ? pqrst(phase) + (Math.random() - 0.5) * 0.015 : 0;
        ys[Math.floor(x)] = h * 0.72 - amp * h * 0.62;
        x = (x + 1) % ys.length;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = colorRef.current;
      ctx.lineWidth = 1.5;
      ctx.lineJoin = "round";
      ctx.beginPath();
      let pen = false;
      for (let i = 0; i < ys.length; i++) {
        const ahead = (i - x + ys.length) % ys.length;
        if (ahead < GAP_PX || Number.isNaN(ys[i])) { pen = false; continue; }   // the sweep's erase gap
        if (pen) ctx.lineTo(i, ys[i]); else { ctx.moveTo(i, ys[i]); pen = true; }
      }
      ctx.stroke();
      // bright head at the sweep position
      const head = (Math.floor(x) - 1 + ys.length) % ys.length;
      if (!Number.isNaN(ys[head])) { ctx.fillStyle = colorRef.current; ctx.beginPath(); ctx.arc(head, ys[head], 2, 0, Math.PI * 2); ctx.fill(); }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  return <canvas ref={canvas} className="h-11 w-full" aria-label={`Simulated ECG at ${hr ? Math.round(hr) : "—"} bpm`} role="img" />;
}
