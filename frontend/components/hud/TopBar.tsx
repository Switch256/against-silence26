"use client";
import { useEffect, useRef, useState } from "react";
import { useLinkVisual } from "@/hooks/useLinkVisual";
import { DSN_STATIONS } from "@/lib/constants";
import { fmtDuration, pad2 } from "@/lib/format";
import { oneWayDelayS, servingStation, useStore } from "@/lib/store";
import { Logo } from "./icons";

function useNow(ms = 1000) {
  const [t, setT] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setT(Date.now()), ms);
    return () => window.clearInterval(id);
  }, [ms]);
  return t;
}

function LinkStatus() {
  const link = useLinkVisual();
  const mission = useStore((s) => s.mission);
  const online = useStore((s) => s.online);
  const station = DSN_STATIONS.find((s) => s.id === servingStation(mission))!;
  const downSince = useRef<number | null>(null);
  const t = useNow(500);
  if (link === "down" && downSince.current === null) downSince.current = Date.now();
  if (link === "up") downSince.current = null;

  const cfg =
    link === "up"
      ? { c: "#38e1ff", bg: "rgba(56,225,255,0.08)", title: "Link acquired", sub: `DSN ${station.name} · ${station.place}` }
      : link === "window"
        ? { c: "#ffb020", bg: "rgba(255,176,32,0.12)", title: "Short contact window", sub: "headlines first · 250 B budget" }
        : {
            c: "#ff3b4f",
            bg: "rgba(255,59,79,0.12)",
            title: "Blackout · link lost",
            sub: `silent for ${fmtDuration(downSince.current ? (t - downSince.current) / 1000 : 0)} · bundles held on board`,
          };

  return (
    <div
      className="flex items-center gap-3 rounded-xl border px-4 py-1.5 transition-colors duration-500"
      style={{ borderColor: `${cfg.c}55`, background: cfg.bg, boxShadow: `0 0 30px ${cfg.c}22` }}
    >
      <span className="relative flex h-2.5 w-2.5">
        <span className="absolute inset-0 animate-ping rounded-full opacity-60" style={{ background: cfg.c }} />
        <span className="relative h-2.5 w-2.5 rounded-full" style={{ background: cfg.c, boxShadow: `0 0 10px ${cfg.c}` }} />
      </span>
      <div className="leading-tight">
        <div className="font-mono text-[12px] font-semibold uppercase tracking-[0.2em]" style={{ color: cfg.c }}>
          {online ? cfg.title : "Telemetry offline"}
        </div>
        <div className="font-mono text-[10px] text-dim">{online ? cfg.sub : "waiting for the MEDLINK backend…"}</div>
      </div>
    </div>
  );
}

function Stat({ k, v, accent }: { k: string; v: React.ReactNode; accent?: string }) {
  return (
    <div className="flex flex-col items-end leading-tight">
      <span className="label !text-[9px]">{k}</span>
      <span className="font-mono text-[13px] tabular-nums" style={{ color: accent ?? "var(--color-ink)" }}>{v}</span>
    </div>
  );
}

export function TopBar() {
  const stats = useStore((s) => s.stats);
  const sc = useStore((s) => s.spacecraft);
  const mission = useStore((s) => s.mission);
  const t = useNow(1000);
  const startRef = useRef(Date.now());
  const d = new Date(t);
  const utc = `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())}`;
  const met = mission?.mission_time_s != null ? mission.mission_time_s + (t - (useStore.getState().lastUpdate || t)) / 1000 : (t - startRef.current) / 1000;
  const delayMin = oneWayDelayS(sc, mission) / 60;
  const transport = stats?.transport ?? sc?.transport;
  const dist = mission?.spacecraft?.distance_km;

  return (
    <header className="glass pointer-events-auto absolute top-4 right-4 left-4 flex h-[60px] items-center justify-between gap-6 px-4">
      <div className="flex min-w-0 items-center gap-3">
        <Logo className="h-9 w-9 shrink-0" />
        <div className="leading-tight">
          <div className="text-[15px] font-semibold tracking-[0.24em]">AEGIS-MEDLINK</div>
          <div className="font-mono text-[10px] tracking-[0.12em] text-dim">
            Care Beyond Connectivity
          </div>
        </div>
      </div>

      <LinkStatus />

      <div className="flex items-center gap-4">
        <span
          className="rounded-md border px-2 py-1 font-mono text-[10.5px] tracking-[0.12em]"
          style={
            transport === "dtn"
              ? { borderColor: "rgba(56,225,255,0.45)", color: "#7fecff", background: "rgba(56,225,255,0.07)" }
              : { borderColor: "rgba(138,160,189,0.35)", color: "#8aa0bd" }
          }
          title="Transport between spacecraft and Earth"
        >
          {transport === "dtn" ? "BPv7 · dtn7-rs" : transport ? "LOCAL TRANSPORT" : "—"}
        </span>
        <Stat k="One-way light" v={`${delayMin.toFixed(delayMin < 10 ? 1 : 0)} min`} accent="#7fecff" />
        {dist ? <Stat k={mission?.spacecraft?.phase ?? "Distance"} v={`${(dist / 1e6).toFixed(1)} M km`} /> : null}
        <Stat k="Mission clock" v={`T+ ${fmtDuration(met)}`} />
        <Stat k="UTC" v={utc} />
      </div>
    </header>
  );
}
