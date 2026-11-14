"use client";
// Mission Scenario Controller. A demo/simulation tool for the presenter, deliberately separated
// from the operational consoles: closed by default, opens as an overlay drawer ("Demo controls"
// in the top bar, or the D key), labelled and hatched so it never reads as part of the crew UI.
import { useEffect, useState, type ReactNode } from "react";
import { useMission } from "@/hooks/useMission";
import { useLinkVisual } from "@/hooks/useLinkVisual";
import type { Scenario } from "@/lib/api";
import { useStore } from "@/lib/store";
import { CloseIcon, ResetIcon } from "@/components/ui/icons";
import { BandwidthGauge } from "./BandwidthGauge";
import { NodeCounters } from "./NodeCounters";

const CREW: { id: Scenario; label: string; count: number; force?: boolean; hint: string }[] = [
  { id: "normal", label: "Nominal", count: 60, hint: "60 resting readings" },
  { id: "spike", label: "Physiological anomaly", count: 30, force: true, hint: "heart-rate rise at rest, alert guaranteed" },
  { id: "low_oxygen", label: "Low oxygen", count: 10, force: true, hint: "SpO₂ drop, alert guaranteed" },
  { id: "exercise", label: "Exercise", count: 10, hint: "high heart rate explained by activity: no alert" },
  { id: "loose_watch", label: "Loose sensor", count: 10, hint: "poor signal: readings discounted, no alert" },
];

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="text-[11px] text-fg-3">{title}</span>
      <div className="flex flex-wrap items-center gap-1.5">{children}</div>
    </div>
  );
}

const Divider = () => <div className="h-12 w-px shrink-0 bg-line" />;

export function ScenarioController() {
  const { actions, online, spaceWeather } = useMission();
  const link = useLinkVisual();
  const open = useStore((s) => s.demoOpen);
  const setOpen = useStore((s) => s.setDemoOpen);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "d" || e.key === "D") setOpen(!useStore.getState().demoOpen);
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);
  const [busy, setBusy] = useState<string | null>(null);
  const run = (key: string, fn: () => Promise<unknown>) => async () => {
    setBusy(key);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  };
  const dis = (key: string) => !online || busy !== null || busy === key;
  const replay = spaceWeather?.mode === "replay";

  if (!open) return null;
  return (
    <section
      className="enter fixed inset-x-2 bottom-2 z-30 rounded-md border border-line-strong bg-sunken shadow-[0_-12px_40px_rgba(0,0,0,0.55)]"
      aria-label="Mission scenario controller (demo)"
    >
      <header
        className="flex h-9 items-center gap-3 rounded-t-md border-b border-line px-4"
        style={{ backgroundImage: "repeating-linear-gradient(135deg, rgba(255,255,255,0.03) 0 8px, transparent 8px 16px)" }}
      >
        <span className="text-[13px] font-semibold text-fg-2">Mission scenario controller</span>
        <span className="tag">Demo · simulation</span>
        <span className="truncate text-[12px] text-fg-4">Not part of the astronaut&apos;s operational interface. Press D to show or hide.</span>
        <button className="btn btn-quiet ml-auto !h-7 !px-2" onClick={() => setOpen(false)} aria-label="Close"><CloseIcon className="h-4 w-4" /></button>
      </header>
      <div className="flex items-start gap-5 px-4 pt-3 pb-3">
          <div className="flex min-w-0 flex-1 flex-wrap items-start gap-x-5 gap-y-2.5">
          <Group title="Crew physiology (simulated)">
            {CREW.map((s) => (
              <button key={s.id} className="btn" title={s.hint} disabled={dis(s.id)} onClick={run(s.id, () => actions.sim(s.id, s.count, !!s.force))}>
                {busy === s.id ? "Running…" : s.label}
              </button>
            ))}
          </Group>
          <Group title="Space weather (real NASA DONKI data)">
            <button className="btn" disabled={dis("sep") || replay} onClick={run("sep", () => actions.spaceWeatherReplay("may-2024"))} title="Replays the real May 2024 solar particle event">
              Solar particle event · May 2024 replay
            </button>
            <button className="btn" disabled={dis("live") || !replay} onClick={run("live", () => actions.spaceWeatherReplay("live"))}>
              Back to live
            </button>
          </Group>
          <Group title="Space link">
            <button className="btn" disabled={dis("down") || link === "down"} onClick={run("down", () => actions.setLink("down"))}>Communication blackout</button>
            <button className="btn" disabled={dis("window") || link === "up"} onClick={run("window", () => actions.openWindow(250, 8))} title="8 s contact, 250 byte budget">
              Short contact window
            </button>
            <button className="btn" disabled={dis("up") || link === "up"} onClick={run("up", () => actions.setLink("up"))}>Restore link</button>
          </Group>
          </div>
          <Divider />
          <BandwidthGauge />
          <Divider />
          <NodeCounters />
          <button className="btn btn-quiet self-center" disabled={dis("reset")} onClick={run("reset", () => actions.reset())} title="Empty everything for a fresh run">
            <ResetIcon className="h-4 w-4" /> Reset
          </button>
      </div>
    </section>
  );
}
