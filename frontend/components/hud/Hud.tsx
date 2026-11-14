"use client";
// The HUD overlay. Pointer events pass through to the 3D scene except on the panels.
import { useEffect, useRef, useState } from "react";
import type { Reply } from "@/lib/api";
import { isInFlight, useStore, type CameraView } from "@/lib/store";
import { AegisPanel } from "./AegisPanel";
import { EarthConsole } from "./EarthConsole";
import { MissionDock } from "./MissionDock";
import { TopBar } from "./TopBar";
import { VitalsPanel } from "./VitalsPanel";

const VIEWS: { id: CameraView; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "spacecraft", label: "Spacecraft" },
  { id: "earth", label: "Earth" },
];

function ViewSwitcher() {
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);
  return (
    <div className="glass pointer-events-auto flex gap-0.5 !rounded-full p-1">
      {VIEWS.map((v) => (
        <button
          key={v.id}
          onClick={() => setView(v.id)}
          className={`rounded-full px-3.5 py-1 font-mono text-[10.5px] tracking-[0.14em] uppercase transition-all ${view === v.id ? "bg-link/15 text-link shadow-[inset_0_0_0_1px_rgba(56,225,255,0.4)]" : "text-dim hover:text-ink"}`}
        >
          {v.label}
        </button>
      ))}
    </div>
  );
}

function kindColor(kind: string) {
  const k = kind.toLowerCase();
  if (k.includes("down") || k.includes("lost")) return "#ff3b4f";
  if (k.includes("window")) return "#ffb020";
  if (k.includes("alert")) return "#ff8a1f";
  if (k.includes("reply")) return "#2fe39a";
  if (k.includes("deliver") || k.includes("arrive")) return "#3d8bff";
  if (k.includes("up") || k.includes("send") || k.includes("sent")) return "#38e1ff";
  if (k.includes("check")) return "#ffb020";
  return "#8aa0bd";
}

function MissionLog() {
  const local = useStore((s) => s.log);
  const mission = useStore((s) => s.mission);
  // Backend events (newest first) when /api/mission exists, otherwise the locally derived log.
  const events = mission?.events?.length
    ? mission.events
        .map((e, i) => ({ id: `${e.ts}-${i}`, ts: Date.parse(e.ts) || Date.now(), kind: e.kind, text: e.text }))
        .sort((a, b) => a.ts - b.ts)
        .slice(-5)
    : local.slice(-5);
  if (!events.length) return null;
  return (
    <div className="pointer-events-none flex flex-col gap-0.5">
      {events.map((e, i) => {
        const d = new Date(e.ts);
        const age = events.length - 1 - i;
        return (
          <div key={e.id} className="rise-in flex items-center gap-2 font-mono text-[10.5px]" style={{ opacity: 1 - age * 0.18 }}>
            <span className="text-faint tabular-nums">
              {String(d.getUTCHours()).padStart(2, "0")}:{String(d.getUTCMinutes()).padStart(2, "0")}:{String(d.getUTCSeconds()).padStart(2, "0")}
            </span>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: kindColor(e.kind) }} />
            <span className="text-ink/80">{e.text}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Center toast when a reply from Earth lands on board. */
function IncomingMessage() {
  const replies = useStore((s) => s.spacecraft?.replies);
  const flights = useStore((s) => s.flights);
  const seen = useRef<Set<string> | null>(null);
  const [msg, setMsg] = useState<Reply | null>(null);

  useEffect(() => {
    if (!replies) return;
    const landed = replies.filter((r) => !isInFlight(flights, r.reply_id));
    if (seen.current === null) {
      seen.current = new Set(landed.map((r) => r.reply_id));
      return;
    }
    const fresh = landed.find((r) => !seen.current!.has(r.reply_id));
    landed.forEach((r) => seen.current!.add(r.reply_id));
    if (fresh) setMsg(fresh);
  }, [replies, flights]);

  useEffect(() => {
    if (!msg) return;
    const id = window.setTimeout(() => setMsg(null), 9000);
    return () => window.clearTimeout(id);
  }, [msg]);

  if (!msg) return null;
  return (
    <div key={msg.reply_id} className="rise-in glass pointer-events-auto max-w-[460px] !border-reply/40 px-5 py-3 shadow-[0_0_40px_rgba(47,227,154,0.18)]">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 animate-pulse rounded-full bg-reply shadow-[0_0_10px_#2fe39a]" />
        <span className="font-mono text-[10px] tracking-[0.2em] text-reply uppercase">Message from Earth · received on board</span>
      </div>
      <p className="mt-1.5 text-[15px] leading-snug">{msg.text}</p>
      <div className="mt-1 font-mono text-[10px] text-dim">{msg.author}</div>
    </div>
  );
}

export function Hud() {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 select-none">
      <TopBar />

      <div className="absolute top-[88px] bottom-[112px] left-4 flex w-[340px] flex-col gap-3">
        <VitalsPanel />
        <AegisPanel />
      </div>

      <div className="absolute top-[88px] right-4 bottom-[112px] w-[372px]">
        <EarthConsole />
      </div>

      <div className="absolute top-[88px] right-[404px] left-[372px] flex flex-col items-center gap-3">
        <ViewSwitcher />
        <IncomingMessage />
      </div>

      <div className="absolute right-[404px] bottom-[112px] left-[372px] flex items-end justify-between gap-4 px-1">
        <MissionLog />
        <div className="shrink-0 text-right font-mono text-[9.5px] leading-relaxed tracking-[0.14em] text-faint uppercase">
          Distances not to scale
          <br />
          Light delay compressed for display
        </div>
      </div>

      <MissionDock />
    </div>
  );
}
