"use client";
// Mission clock under the HUD: elapsed time to the microsecond and the cruise numbers, updated every
// frame (written straight to the DOM, no React re-render per frame).
// Mission elapsed time comes from the backend (time since the first reading, interpolated between polls).
// The cruise profile is SIMULATED, anchored to the backend's distance (14 light-minutes) at T+0.
import { useEffect, useRef } from "react";
import { useStore } from "@/lib/store";

const C_KM_S = 299_792.458;
/** Simulated Earth-Mars cruise, mid-transfer (typical Hohmann-class values). */
const PROFILE = {
  heliocentricKmS: 24.13,          // speed around the Sun
  rangeRateKmS: 5.92,              // how fast the distance from Earth grows
  marsClosingKmS: 2.41,            // how fast the distance to Mars shrinks
  travelledAtT0Km: 409_486_200,    // path flown since departure, at T+0 (~ day 182)
  marsAtT0Km: 41_236_800,          // distance to Mars at T+0
};

const pad = (n: number, w = 2) => String(Math.floor(n)).padStart(w, "0");
const km = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

function met(s: number) {
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const us = Math.floor((sec - Math.floor(sec)) * 1e6);
  return `T+ ${pad(d, 3)}:${pad(h)}:${pad(m)}:${pad(sec)}.${pad(us, 6)}`;
}

function lightTime(distKm: number) {
  const t = distKm / C_KM_S;
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m} min ${s.toFixed(6).padStart(9, "0")} s`;
}

function arrival(s: number) {
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${d} d ${pad(h)} h ${pad(m)} m ${pad(s % 60)} s`;
}

export function MissionClock() {
  const refs = {
    met: useRef<HTMLSpanElement>(null),
    travelled: useRef<HTMLSpanElement>(null),
    earth: useRef<HTMLSpanElement>(null),
    light: useRef<HTMLSpanElement>(null),
    mars: useRef<HTMLSpanElement>(null),
    eta: useRef<HTMLSpanElement>(null),
  };
  const shown = useRef(0);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const { mission, lastUpdate } = useStore.getState();
      const base = mission?.mission_time_s ?? 0;
      const earth0 = mission?.spacecraft?.distance_km ?? 251_798_665;
      // sub-millisecond wall time: performance.timeOrigin + performance.now()
      const nowMs = performance.timeOrigin + performance.now();
      let t = base + Math.max(0, (nowMs - (lastUpdate || nowMs)) / 1000);
      // polls are rounded to whole seconds: never let the clock step backwards
      if (t < shown.current && shown.current - t < 2) t = shown.current;
      shown.current = t;

      const earthKm = earth0 + PROFILE.rangeRateKmS * t;
      const marsKm = Math.max(0, PROFILE.marsAtT0Km - PROFILE.marsClosingKmS * t);
      const set = (r: React.RefObject<HTMLSpanElement | null>, v: string) => { if (r.current) r.current.textContent = v; };
      set(refs.met, met(t));
      set(refs.travelled, `${km(PROFILE.travelledAtT0Km + PROFILE.heliocentricKmS * t)} km`);
      set(refs.earth, `${km(earthKm)} km`);
      set(refs.light, lightTime(earthKm));
      set(refs.mars, `${km(marsKm)} km`);
      set(refs.eta, arrival(marsKm / PROFILE.marsClosingKmS));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const item = (label: string, ref: React.RefObject<HTMLSpanElement | null>, strong = false) => (
    <div className="leading-tight">
      <div className="text-[10.5px] text-fg-4">{label}</div>
      <span ref={ref} className={`font-mono tabular-nums ${strong ? "text-[13px] text-fg" : "text-[12px] text-fg-2"}`} />
    </div>
  );

  return (
    <div
      className="flex flex-wrap items-end gap-x-6 gap-y-2 rounded-[10px] bg-[rgba(8,10,12,0.55)] px-3 py-2 backdrop-blur-sm"
      title={`Mission elapsed time from the backend. Cruise profile simulated: ${PROFILE.heliocentricKmS} km/s around the Sun, distance from Earth growing ${PROFILE.rangeRateKmS} km/s.`}
    >
      {item("Mission elapsed time", refs.met, true)}
      {item(`Travelled · ${PROFILE.heliocentricKmS} km/s`, refs.travelled)}
      {item("From Earth", refs.earth)}
      {item("One-way light time", refs.light)}
      {item("To Mars", refs.mars)}
      {item("Mars arrival in", refs.eta)}
      <span className="tag self-center text-[10px]">Simulated cruise</span>
    </div>
  );
}
