"use client";
// The 3D situational-awareness view (the hero): caption, camera presets, notification toasts,
// a legend behind "?", the ambient log ticker, and the DSN antenna inset in the Ground station view.
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { requestZoom } from "@/components/scene/CameraRig";
import { autoCameraUserMoved, startAutoCamera } from "@/lib/autoCamera";
import { COLORS } from "@/lib/constants";
import { useStore, type CameraView } from "@/lib/store";
import { GroundStationInset } from "./GroundStationInset";
import { LogTicker } from "./LogTicker";
import { Toasts } from "./Toasts";

const Scene = dynamic(() => import("@/components/scene/Scene"), { ssr: false });

const PRESETS: { id: CameraView; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "spacecraft", label: "Spacecraft" },
  { id: "earth", label: "Ground station" },
];

/** The camera directs itself (lib/autoCamera.ts); this only says which shot is on screen.
 *  Presenter shortcut: keys 1 / 2 / 3 jump to a shot, then auto resumes after 30 s. */
function CameraCaption() {
  const view = useStore((s) => s.view);
  useEffect(() => {
    startAutoCamera();
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      const v = ({ "1": "overview", "2": "spacecraft", "3": "earth" } as Record<string, CameraView>)[e.key];
      if (v) { useStore.getState().autoSetView(v); autoCameraUserMoved(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const label = PRESETS.find((p) => p.id === view)?.label ?? "";
  return (
    <div className="flex items-center gap-1.5 rounded border border-line bg-[rgba(14,16,17,0.7)] px-2.5 py-1 text-[11px] text-fg-3" title="The camera follows events automatically. Drag to look around; it takes over again after 30 s.">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
      Auto camera · <span key={view} className="enter text-fg-2">{label}</span>
    </div>
  );
}

function Legend() {
  const [open, setOpen] = useState(false);
  return (
    <div className="pointer-events-auto flex flex-col items-start gap-2">
      {open && (
        <div className="enter flex flex-col gap-1 rounded border border-line bg-[rgba(14,16,17,0.88)] px-2.5 py-2 text-[11px] text-fg-3">
          <span className="flex items-center gap-2"><span className="h-px w-5" style={{ background: COLORS.accent }} /> Space link (BPv7)</span>
          <span className="flex items-center gap-2"><span className="h-px w-5" style={{ background: COLORS.caution }} /> Short contact window</span>
          <span className="flex items-center gap-2"><span className="mx-1.5 h-2 w-2 rounded-full" style={{ background: COLORS.accent }} /> PulseBrief bundle</span>
          <span className="flex items-center gap-2"><span className="mx-1.5 h-2 w-2 rounded-full bg-fg" /> Reply from Earth</span>
          <span className="mt-1 text-fg-4">Distances, sizes and orbital periods not to scale.<br />Light delay compressed for display.</span>
          <span className="mt-1 text-fg-4">Hover a body for its name.</span>
          <a
            href="https://github.com/Switch256/against-silence26/blob/main/ATTRIBUTIONS.md"
            target="_blank"
            rel="noreferrer"
            className="mt-1 text-fg-3 underline decoration-line-strong underline-offset-2 hover:text-fg"
          >
            3D assets and maps: NASA 3D Resources, NASA SVS, NASA Earth Observatory
          </a>
        </div>
      )}
      <button onClick={() => setOpen(!open)} className="flex h-6 w-6 items-center justify-center rounded-full border border-line-strong bg-[rgba(14,16,17,0.8)] text-[12px] text-fg-3 hover:text-fg" aria-label="Legend" aria-expanded={open}>?</button>
    </div>
  );
}

function ZoomControls() {
  const view = useStore((s) => s.view);
  const tool = useStore((s) => s.tool);
  const setTool = useStore((s) => s.setTool);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === "+" || e.key === "=") requestZoom(0.7);
      else if (e.key === "-" || e.key === "_") requestZoom(1 / 0.7);
      else if (e.key === "h" || e.key === "H") useStore.setState((s) => ({ tool: s.tool === "pan" ? "orbit" : "pan" }));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const btn = "flex h-8 w-8 items-center justify-center text-[16px] leading-none text-fg-2 hover:bg-raised hover:text-fg";
  return (
    <div className="pointer-events-auto flex flex-col overflow-hidden rounded border border-line-strong bg-[rgba(14,16,17,0.85)]" role="group" aria-label="Navigate">
      <button className={`${btn} ${tool === "pan" ? "!bg-[#1d2a3a] !text-accent" : ""}`} onClick={() => setTool("pan")} aria-pressed={tool === "pan"} aria-label="Hand tool" title="Hand: drag to move around (H)">
        <svg viewBox="0 0 20 20" className="h-[17px] w-[17px]" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M7 10V4.5a1.25 1.25 0 0 1 2.5 0V9M9.5 8.5V3.25a1.25 1.25 0 0 1 2.5 0V9M12 8.75V4.5a1.25 1.25 0 0 1 2.5 0v6.5c0 3.5-2.2 6-5.5 6-2.4 0-3.6-1.1-4.9-3.1L2.6 11.2a1.2 1.2 0 0 1 1.9-1.5L7 12.5" />
        </svg>
      </button>
      <button className={`${btn} border-t border-line ${tool === "orbit" ? "!bg-[#1d2a3a] !text-accent" : ""}`} onClick={() => setTool("orbit")} aria-pressed={tool === "orbit"} aria-label="Rotate tool" title="Rotate: drag to orbit (H toggles)">
        <svg viewBox="0 0 20 20" className="h-[17px] w-[17px]" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden>
          <ellipse cx="10" cy="10" rx="7.5" ry="3.2" />
          <path d="M14.5 5.2 16.6 6.6 15 8.5" />
          <circle cx="10" cy="10" r="1.4" fill="currentColor" stroke="none" />
        </svg>
      </button>
      <button className={`${btn} border-t border-line-strong`} onClick={() => requestZoom(0.6)} aria-label="Zoom in" title="Zoom in (+, scroll or pinch)">+</button>
      <button className={`${btn} border-t border-line`} onClick={() => requestZoom(1 / 0.6)} aria-label="Zoom out" title="Zoom out (−)">−</button>
      <button className={`${btn} border-t border-line text-[12px]`} onClick={() => useStore.getState().autoSetView(view)} aria-label="Fit view" title="Fit the current view">⤢</button>
    </div>
  );
}

export function Viewport() {
  const view = useStore((s) => s.view);
  const mission = useStore((s) => s.mission);
  const dist = mission?.spacecraft?.distance_km;
  return (
    <section className="panel relative min-h-0 flex-1 overflow-hidden !bg-[#030405]">
      <Scene />
      <div className="pointer-events-none absolute inset-x-0 top-0 z-40 flex items-start justify-between p-4">
        <div className="leading-tight">
          <div className="text-[13px] font-semibold">Situational awareness</div>
          <div className="num text-[12px] text-fg-3">
            {mission?.spacecraft?.phase ?? "AEGIS-1"}{dist ? ` · ${(dist / 1e6).toFixed(1)} million km from Earth` : ""} · not to scale
          </div>
        </div>
        <div className="flex flex-col items-end gap-3">
          <CameraCaption />
          <Toasts />
        </div>
      </div>
      <div className="pointer-events-none absolute bottom-10 left-4 z-40 flex flex-col items-start gap-2">
        <ZoomControls />
        <Legend />
      </div>
      {view === "earth" && (
        <div className="enter absolute right-4 bottom-10 z-40">
          <GroundStationInset />
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 z-40">
        <LogTicker />
      </div>
    </section>
  );
}
