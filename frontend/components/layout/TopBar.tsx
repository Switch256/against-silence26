"use client";
// Mission status bar: five fields (mission clock, link, light time, serving DSN station, transport),
// then the space-weather status, the notification bell and the demo controls.
import { BASE_PATH } from "@/lib/config";
import type { ReactNode } from "react";
import { useLinkVisual } from "@/hooks/useLinkVisual";
import { useNow } from "@/hooks/useNow";
import { DSN_STATIONS } from "@/lib/constants";
import { fmtDuration, pad2 } from "@/lib/format";
import { oneWayDelayS, servingStation, useStore } from "@/lib/store";
import { BellIcon, Logo, UserIcon } from "@/components/ui/icons";
import { StatusText, type StatusLevel } from "@/components/ui/Status";
import { spaceWeatherStatus } from "@/components/crew/SpaceWeather";

function Field({ label, children, title, className = "" }: { label: string; children: ReactNode; title?: string; className?: string }) {
  return (
    <div className={`flex min-w-0 shrink-0 flex-col justify-center overflow-hidden px-3 whitespace-nowrap 2xl:px-5 ${className}`} title={title}>
      <span className="text-[10px] leading-[13px] text-fg-3">{label}</span>
      <span className="num truncate text-[13px] leading-[18px] font-medium text-fg">{children}</span>
    </div>
  );
}

function LinkField() {
  const link = useLinkVisual();
  const sc = useStore((s) => s.spacecraft);
  const online = useStore((s) => s.online);
  const t = useNow(500);
  const left = sc?.link.window_until ? Math.max(0, Math.ceil((Date.parse(sc.link.window_until) - t) / 1000)) : null;
  const cfg: { level: StatusLevel; text: string } = !online
    ? { level: "neutral", text: "No telemetry" }
    : link === "up"
      ? { level: "nominal", text: "Link up" }
      : link === "window"
        ? { level: "caution", text: `Contact window${left != null ? ` · ${left} s` : ""}` }
        : { level: "warning", text: "Link down · LOS" };
  return (
    <div className="flex min-w-[150px] flex-col justify-center px-3 whitespace-nowrap 2xl:px-5">
      <span className="text-[10px] leading-[13px] text-fg-3">Space link</span>
      <span className="text-[13px] leading-[18px]"><StatusText level={cfg.level}>{cfg.text}</StatusText></span>
    </div>
  );
}

function SpaceWeatherChip() {
  const sw = useStore((s) => s.spaceWeather);
  if (!sw) return null;
  const word = sw.level === "info" ? "Advisory" : sw.level.charAt(0).toUpperCase() + sw.level.slice(1);
  return (
    <div className="flex items-center gap-2 text-[12px]" title={`${sw.headline} · ${sw.source}`}>
      <span className="hidden text-fg-3 min-[1400px]:inline">Space weather</span>
      <StatusText level={spaceWeatherStatus(sw.level)}>{word}</StatusText>
      {sw.mode === "replay" && <span className="tag">Replay</span>}
    </div>
  );
}

function CrewButton() {
  const setCrewOpen = useStore((s) => s.setCrewOpen);
  return (
    <button className="btn btn-quiet !px-2" onClick={() => setCrewOpen(true)} title="Crew record: profiles, every measurement, export" aria-label="Crew record">
      <UserIcon className="h-[18px] w-[18px]" />
    </button>
  );
}

function Bell() {
  const unread = useStore((s) => s.unread);
  const setLogOpen = useStore((s) => s.setLogOpen);
  return (
    <button className="btn btn-quiet relative !px-2" onClick={() => setLogOpen(true)} title="Mission event log" aria-label={`Mission event log, ${unread} new`}>
      <BellIcon className="h-[18px] w-[18px]" />
      {unread > 0 && (
        <span className="num absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-bg">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </button>
  );
}

function PanelIcon({ side, on }: { side: "left" | "right"; on: boolean }) {
  const x = side === "left" ? 2.5 : 12.5;
  return (
    <svg viewBox="0 0 18 18" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden>
      <rect x="1.5" y="2.5" width="15" height="13" rx="1.5" />
      <rect x={x} y="3.5" width="3" height="11" fill={on ? "currentColor" : "none"} stroke="none" opacity={on ? 0.85 : 0} />
      <line x1={side === "left" ? 6.5 : 11.5} x2={side === "left" ? 6.5 : 11.5} y1="2.5" y2="15.5" />
    </svg>
  );
}

/** Show/hide the crew and Earth consoles (also [ and ] keys). */
function PanelToggles() {
  const panels = useStore((s) => s.panels);
  const toggle = useStore((s) => s.togglePanel);
  return (
    <div className="flex items-center">
      <button className={`btn btn-quiet !px-1.5 ${panels.crew ? "text-fg" : "text-fg-4"}`} onClick={() => toggle("crew")} aria-pressed={panels.crew}
        title={`${panels.crew ? "Hide" : "Show"} the spacecraft console ([)`} aria-label="Spacecraft console panel">
        <PanelIcon side="left" on={panels.crew} />
      </button>
      <button className={`btn btn-quiet !px-1.5 ${panels.earth ? "text-fg" : "text-fg-4"}`} onClick={() => toggle("earth")} aria-pressed={panels.earth}
        title={`${panels.earth ? "Hide" : "Show"} the Earth console (])`} aria-label="Earth console panel">
        <PanelIcon side="right" on={panels.earth} />
      </button>
    </div>
  );
}

export function TopBar() {
  const sc = useStore((s) => s.spacecraft);
  const stats = useStore((s) => s.stats);
  const mission = useStore((s) => s.mission);
  const lastUpdate = useStore((s) => s.lastUpdate);
  const demo = useStore((s) => s.demoFallback);
  const setDemoOpen = useStore((s) => s.setDemoOpen);
  const demoOpen = useStore((s) => s.demoOpen);
  const t = useNow(1000);
  const d = new Date(t);
  const utc = `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())} UTC`;
  const met = mission?.mission_time_s != null ? mission.mission_time_s + Math.max(0, (t - (lastUpdate || t)) / 1000) : null;
  const delayMin = oneWayDelayS(sc, mission) / 60;
  const station = DSN_STATIONS.find((s) => s.id === servingStation(mission))!;
  const transport = stats?.transport ?? sc?.transport;

  return (
    <header className="flex h-[42px] shrink-0 items-stretch bg-surface [&_.btn]:h-7">
      <a href={`${BASE_PATH}/`} className="flex items-center gap-2.5 pr-4 pl-4 hover:opacity-80" title="Back to the AEGIS-MEDLINK home page · Team Against the Silence">
        <Logo className="h-6 w-6 text-fg-2" />
        <div className="text-[14px] font-semibold tracking-[0.02em] whitespace-nowrap">AEGIS-MEDLINK</div>
      </a>
      <div className="my-3 w-px bg-line" />
      <Field label="Mission elapsed" title={utc}>{met != null ? `T+ ${fmtDuration(met)}` : "—"}</Field>
      <LinkField />
      <Field label="One-way light time" className="hidden lg:flex">{`${delayMin.toFixed(delayMin < 10 ? 1 : 0)} min`}</Field>
      <Field label="Serving ground station" title={station.place} className="hidden lg:flex">{`DSN ${station.name} · ${station.antenna}`}</Field>
      <Field label="Transport" className="hidden min-[1400px]:flex">{transport === "dtn" ? "BPv7 · dtn7-rs" : transport === "demo" ? "Offline demo" : transport ? "Local queue" : "—"}</Field>

      <div className="ml-auto flex items-center gap-3 pr-3">
        {demo && <span className="tag" title="Backend unreachable: showing built-in sample data">Sample data</span>}
        <SpaceWeatherChip />
        <div className="mx-1 h-6 w-px bg-line" />
        <PanelToggles />
        <CrewButton />
        <Bell />
        <button className="btn" onClick={() => setDemoOpen(!demoOpen)} aria-expanded={demoOpen} title="Mission scenario controller (demo) · shortcut D">
          Demo controls
        </button>
      </div>
    </header>
  );
}
