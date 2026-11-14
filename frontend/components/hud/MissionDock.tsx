"use client";
// Bottom dock: simulator scenarios, link controls, reset, and the bandwidth gauge.
import { useState } from "react";
import { useMission } from "@/hooks/useMission";
import { useLinkVisual } from "@/hooks/useLinkVisual";
import type { Scenario } from "@/lib/api";
import { COLORS } from "@/lib/constants";
import { fmtBytes } from "@/lib/format";
import { useStore } from "@/lib/store";
import { CutIcon, LinkIcon, ResetIcon, WindowIcon } from "./icons";

const SCENARIOS: { id: Scenario; label: string; count: number; dot: string }[] = [
  { id: "normal", label: "Normal", count: 60, dot: "#2fe39a" },
  { id: "spike", label: "Heart-rate spike", count: 30, dot: "#ff3b4f" },
  { id: "exercise", label: "Exercise", count: 10, dot: "#38e1ff" },
  { id: "loose_watch", label: "Loose watch", count: 10, dot: "#8aa0bd" },
  { id: "low_oxygen", label: "Low oxygen", count: 3, dot: "#ff8a1f" },
];

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="label !text-[9px]">{title}</span>
      <div className="flex items-center gap-1.5">{children}</div>
    </div>
  );
}

function BandwidthGauge() {
  const stats = useStore((s) => s.stats);
  const sent = stats?.bytes_sent ?? 0;
  const raw = stats?.raw_bytes_equivalent ?? 0;
  const frac = raw > 0 ? Math.min(1, sent / raw) : 0;
  const saved = raw > 0 ? Math.max(0, 1 - frac) : 0;
  const R = 22;
  const C = 2 * Math.PI * R;
  return (
    <div className="flex items-center gap-3" title="Bytes sent over the space link vs. sending every raw reading">
      <div className="relative h-[58px] w-[58px]">
        <svg viewBox="0 0 58 58" className="h-full w-full -rotate-90">
          <circle cx="29" cy="29" r={R} fill="none" stroke="rgba(130,200,255,0.12)" strokeWidth="6" />
          <circle cx="29" cy="29" r={R} fill="none" stroke="#2fe39a" strokeOpacity="0.85" strokeWidth="6" strokeDasharray={`${C * saved} ${C}`} style={{ transition: "stroke-dasharray .8s" }} />
          <circle cx="29" cy="29" r={R} fill="none" stroke={COLORS.link} strokeWidth="6" strokeDasharray={`${Math.max(C * frac, raw ? 1.5 : 0)} ${C}`} strokeDashoffset={-C * saved} style={{ transition: "all .8s", filter: "drop-shadow(0 0 3px #38e1ff)" }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
          <span className="font-mono text-[12px] font-semibold tabular-nums text-reply">{raw ? `${Math.round(saved * 100)}%` : "–"}</span>
          <span className="font-mono text-[7.5px] tracking-[0.1em] text-dim">SAVED</span>
        </div>
      </div>
      <div className="w-[150px] space-y-1.5">
        <div>
          <div className="flex justify-between font-mono text-[9.5px]">
            <span className="text-link">Sent over link</span>
            <span className="tabular-nums text-ink">{fmtBytes(sent)}</span>
          </div>
          <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-white/5">
            <div className="h-full rounded-full bg-link shadow-[0_0_8px_#38e1ff] transition-all duration-700" style={{ width: `${Math.max(frac * 100, sent ? 1.5 : 0)}%` }} />
          </div>
        </div>
        <div>
          <div className="flex justify-between font-mono text-[9.5px]">
            <span className="text-dim">All raw readings</span>
            <span className="tabular-nums text-dim">{fmtBytes(raw)}</span>
          </div>
          <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-white/5">
            <div className="h-full rounded-full bg-white/25 transition-all duration-700" style={{ width: raw ? "100%" : "0%" }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function QueueDots() {
  const outbox = useStore((s) => s.outbox);
  const stats = useStore((s) => s.stats);
  return (
    <div className="flex flex-col gap-1.5">
      <span className="label !text-[9px]">Outbox</span>
      <div className="flex h-9 items-center gap-1">
        {outbox.length === 0 ? (
          <span className="font-mono text-[11px] whitespace-nowrap text-faint">empty · {stats?.delivered ?? 0} delivered</span>
        ) : (
          <>
            {outbox.slice(0, 12).map((b) => (
              <span key={b.id} className="h-3 w-3 rotate-45 rounded-[2px]" style={{ background: COLORS[b.layer], boxShadow: `0 0 8px ${COLORS[b.layer]}` }} title={b.layer} />
            ))}
            <span className="ml-1.5 font-mono text-[11px] whitespace-nowrap text-ink">{outbox.length} held</span>
          </>
        )}
      </div>
    </div>
  );
}

export function MissionDock() {
  const { actions, online } = useMission();
  const link = useLinkVisual();
  const [busy, setBusy] = useState<string | null>(null);
  const run = (key: string, fn: () => Promise<unknown>) => async () => {
    setBusy(key);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  };
  const dis = (key: string) => !online || (busy !== null && busy !== key) || busy === key;

  return (
    <div className="glass pointer-events-auto absolute right-4 bottom-4 left-4 flex h-[84px] items-center gap-5 overflow-x-auto px-4">
      <Group title="Simulate crew readings">
        {SCENARIOS.map((s) => (
          <button key={s.id} className="btn" disabled={dis(s.id)} onClick={run(s.id, () => actions.sim(s.id, s.count))}>
            <span className={`h-1.5 w-1.5 rounded-full ${busy === s.id ? "animate-ping" : ""}`} style={{ background: s.dot, boxShadow: `0 0 6px ${s.dot}` }} />
            {s.label}
            <span className="btn-mult">×{s.count}</span>
          </button>
        ))}
      </Group>

      <div className="h-12 w-px shrink-0 bg-white/10" />

      <Group title="Space link">
        <button className="btn" disabled={dis("down") || link === "down"} onClick={run("down", () => actions.setLink("down"))} style={link === "down" ? { borderColor: "#ff3b4f88", color: "#ff7b88" } : undefined}>
          <CutIcon className="h-4 w-4" /> Cut link
        </button>
        <button className="btn" disabled={dis("window") || link === "up"} onClick={run("window", () => actions.openWindow())} style={link === "window" ? { borderColor: "#ffb02088", color: "#ffc04a" } : undefined}>
          <WindowIcon className="h-4 w-4" /> Short window
        </button>
        <button className="btn" disabled={dis("up") || link === "up"} onClick={run("up", () => actions.setLink("up"))} style={link === "up" ? { borderColor: "#38e1ff66", color: "#7fecff" } : undefined}>
          <LinkIcon className="h-4 w-4" /> Restore link
        </button>
      </Group>

      <div className="h-12 w-px shrink-0 bg-white/10" />
      <QueueDots />
      <div className="ml-auto flex shrink-0 items-center gap-4">
        <BandwidthGauge />
        <button className="btn !h-10 !w-10 justify-center !px-0" title="Reset the demo" disabled={dis("reset")} onClick={run("reset", () => actions.reset())}>
          <ResetIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
