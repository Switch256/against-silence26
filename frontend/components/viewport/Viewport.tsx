"use client";
// The 3D situational-awareness view (the hero): caption, camera presets, notification toasts,
// a legend behind "?", the ambient log ticker, and the DSN antenna inset in the Ground station view.
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { requestZoom } from "@/components/scene/CameraRig";
import { autoCameraUserMoved, startAutoCamera } from "@/lib/autoCamera";
import { COLORS } from "@/lib/constants";
import { useLinkVisual } from "@/hooks/useLinkVisual";
import { useStore, type CameraView } from "@/lib/store";
import { GroundStationInset } from "./GroundStationInset";
import { LogTicker } from "./LogTicker";
import { CrewStrip } from "./CrewStrip";
import { MissionClock } from "./MissionClock";
import { SignalPath } from "./SignalPath";
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
    <div className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg bg-[rgba(14,16,17,0.7)] px-2.5 py-1 text-[11px] text-fg-3" title="The camera follows events automatically. Drag to look around; it takes over again after 15 s.">
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
        <div className="enter flex flex-col gap-1 rounded-lg bg-[rgba(14,16,17,0.88)] px-2.5 py-2 text-[11px] text-fg-3">
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
      <button onClick={() => setOpen(!open)} className="flex h-6 w-6 items-center justify-center rounded-full bg-[rgba(14,16,17,0.8)] text-[12px] text-fg-3 hover:text-fg" aria-label="Legend" aria-expanded={open}>?</button>
    </div>
  );
}

/** Thin HUD over the scene (inspired by flight-sim telemetry): large light numerals, small plain labels. */
function Hud() {
  const mission = useStore((s) => s.mission);
  const sc = useStore((s) => s.spacecraft);
  const held = useStore((s) => s.outbox.length);
  const link = useLinkVisual();
  const dist = mission?.spacecraft?.distance_km;
  const delay = (mission?.spacecraft?.light_delay_s ?? (sc?.eta.one_way_delay_min ?? 14) * 60) / 60;
  const linkWord = link === "up" ? "Up" : link === "window" ? "Window" : "Down";
  const linkColor = link === "up" ? COLORS.nominal : link === "window" ? COLORS.caution : COLORS.warning;
  const items: [string, string, string | undefined][] = [
    [dist ? (dist / 1e6).toFixed(1) : "—", "million km from Earth", undefined],
    [delay.toFixed(0), "min one-way light time", undefined],
    [linkWord, "space link", linkColor],
    [String(held), held === 1 ? "bundle held on board" : "bundles held on board", held ? COLORS.caution : undefined],
  ];
  return (
    <div className="flex min-w-0 flex-nowrap items-center gap-x-8">
      <div className="flex gap-7" title={`${mission?.spacecraft?.phase ?? "Cruise to Mars"} · distances and sizes not to scale`}>
        {items.map(([v, label, color]) => (
          <div key={label} className="leading-none">
            <div className="num text-[28px] font-light tracking-tight" style={color ? { color } : undefined}>{v}</div>
            <div className="mt-1.5 text-[11px] text-fg-3">{label}</div>
          </div>
        ))}
      </div>
      <CrewStrip />
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
  const btn = "flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.07] text-[17px] leading-none text-fg backdrop-blur-md transition-colors hover:bg-white/[0.16]";
  return (
    <div className="pointer-events-auto flex flex-col gap-2" role="group" aria-label="Navigate">
      <button className={`${btn} ${tool === "pan" ? "!bg-accent/30 !text-white" : ""}`} onClick={() => setTool("pan")} aria-pressed={tool === "pan"} aria-label="Hand tool" title="Hand: drag to move around (H)">
        <svg viewBox="0 0 20 20" className="h-[17px] w-[17px]" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M7 10V4.5a1.25 1.25 0 0 1 2.5 0V9M9.5 8.5V3.25a1.25 1.25 0 0 1 2.5 0V9M12 8.75V4.5a1.25 1.25 0 0 1 2.5 0v6.5c0 3.5-2.2 6-5.5 6-2.4 0-3.6-1.1-4.9-3.1L2.6 11.2a1.2 1.2 0 0 1 1.9-1.5L7 12.5" />
        </svg>
      </button>
      <button className={`${btn} ${tool === "orbit" ? "!bg-accent/30 !text-white" : ""}`} onClick={() => setTool("orbit")} aria-pressed={tool === "orbit"} aria-label="Rotate tool" title="Rotate: drag to orbit (H toggles)">
        <svg viewBox="0 0 20 20" className="h-[17px] w-[17px]" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden>
          <ellipse cx="10" cy="10" rx="7.5" ry="3.2" />
          <path d="M14.5 5.2 16.6 6.6 15 8.5" />
          <circle cx="10" cy="10" r="1.4" fill="currentColor" stroke="none" />
        </svg>
      </button>
      <button className={`${btn}`} onClick={() => requestZoom(0.6)} aria-label="Zoom in" title="Zoom in (+, scroll or pinch)">+</button>
      <button className={`${btn}`} onClick={() => requestZoom(1 / 0.6)} aria-label="Zoom out" title="Zoom out (−)">−</button>
      <button className={`${btn} text-[12px]`} onClick={() => useStore.getState().autoSetView(view)} aria-label="Fit view" title="Fit the current view">⤢</button>
    </div>
  );
}

export function Viewport() {
  const view = useStore((s) => s.view);
  return (
    <section className="panel relative min-h-0 flex-1 overflow-hidden !bg-[#030405]">
      <Scene />
      <div className="@container pointer-events-none absolute inset-x-0 top-0 z-40 flex items-start justify-between gap-4 p-4">
        <div className="flex min-w-0 flex-col items-start gap-3">
          <Hud />
          <MissionClock />
        </div>
        <div className="flex shrink-0 flex-col items-end gap-3">
          <CameraCaption />
          <Toasts />
        </div>
      </div>
      <div className="pointer-events-none absolute bottom-10 left-4 z-40 flex flex-col items-start gap-2">
        <ZoomControls />
        <Legend />
      </div>
      {view === "earth" && (
        <div className="enter absolute right-4 bottom-28 z-40">
          <GroundStationInset />
        </div>
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-10 z-40 flex justify-center">
        <SignalPath />
      </div>
      <div className="absolute inset-x-0 bottom-0 z-40">
        <LogTicker />
      </div>
    </section>
  );
}
