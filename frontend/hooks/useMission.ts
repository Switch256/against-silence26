"use client";
// One polling loop for the whole app: /api/spacecraft + /api/earth + /api/stats every second,
// /api/mission when the backend has it. Snapshots land in the zustand store; the tracker turns
// status changes into packet animations.
import { useCallback, useEffect } from "react";
import { api, ApiError, type Feeling, type Scenario } from "@/lib/api";
import { MISSION_RETRY_MS, POLL_MS } from "@/lib/config";
import { ingestSnapshot, resetTracker, useStore } from "@/lib/store";
import { demoEarth, demoMission, demoSpacecraft, demoStats } from "@/lib/demo";

let missionNextTry = 0;
let requestSeq = 0;
let failures = 0;
let lastWindowEvent: string | null = null;
let appliedSeq = 0;

async function pollOnce() {
  const seq = ++requestSeq;
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), 4000);
  try {
    const [spacecraft, earth, stats] = await Promise.all([
      api.spacecraft(ctrl.signal),
      api.earth(ctrl.signal),
      api.stats(ctrl.signal),
    ]);
    if (seq < appliedSeq) return; // a newer poll already landed
    appliedSeq = seq;
    ingestSnapshot(spacecraft, earth);
    failures = 0;
    useStore.setState({ spacecraft, earth, stats, online: true, lastUpdate: Date.now() });
  } catch {
    // one slow poll is not an outage: flag offline after three misses in a row
    if (++failures >= 3) {
      // The public showcase deliberately works without a backend or login.
      ingestSnapshot(demoSpacecraft, demoEarth);
      useStore.setState({ spacecraft: demoSpacecraft, earth: demoEarth, stats: demoStats, mission: demoMission, online: true, lastUpdate: Date.now() });
    }
  } finally {
    window.clearTimeout(timer);
  }

  if (Date.now() >= missionNextTry) {
    try {
      const mission = await api.mission();
      // A short contact window shows up as a backend event: flash the amber beam for it.
      const win = mission.events?.find((e) => e.kind.toLowerCase().includes("window"));
      if (win && lastWindowEvent !== null && win.ts !== lastWindowEvent) useStore.getState().flashWindow();
      lastWindowEvent = win?.ts ?? "";
      useStore.setState({ mission });
      missionNextTry = 0;
    } catch (err) {
      // 404 = older backend without /api/mission: fall back to derived values, retry rarely.
      missionNextTry = Date.now() + (err instanceof ApiError && err.status === 404 ? MISSION_RETRY_MS : POLL_MS * 3);
    }
  }
}

/** Start the polling loop. Call once, at the top of the page. */
export function useMissionPolling() {
  useEffect(() => {
    let alive = true;
    let busy = false;
    const tick = async () => {
      if (busy || !alive) return;
      busy = true;
      await pollOnce();
      busy = false;
    };
    tick();
    const id = window.setInterval(tick, POLL_MS);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);
}

/** Mission data plus the actions that drive the demo. Any component may call this. */
export function useMission() {
  const spacecraft = useStore((s) => s.spacecraft);
  const earth = useStore((s) => s.earth);
  const stats = useStore((s) => s.stats);
  const mission = useStore((s) => s.mission);
  const online = useStore((s) => s.online);

  const run = useCallback(async (p: Promise<unknown>) => {
    try {
      await p;
    } catch (err) {
      console.warn(err);
    }
    await pollOnce();
  }, []);

  const actions = {
    sim: (scenario: Scenario, count: number) => run(api.simStep(scenario, count)),
    checkin: (feeling: Feeling, symptom: string | null) => run(api.checkin(feeling, symptom)),
    markDone: (alertId: string, step: string) => run(api.markDone(alertId, step)),
    setLink: (state: "up" | "down") => run(api.setLink(state)),
    openWindow: () => {
      useStore.getState().flashWindow();
      return run(api.openWindow(250));
    },
    reply: (briefId: string, text: string) => run(api.reply(briefId, text)),
    reset: () => {
      resetTracker();
      useStore.setState({ log: [] });
      return run(api.reset());
    },
  };

  return { spacecraft, earth, stats, mission, online, actions };
}
