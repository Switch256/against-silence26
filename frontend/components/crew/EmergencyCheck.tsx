"use client";
// Emergency check-in (idea and flow by Mariam Saied): on a new urgent heart-rate or oxygen alert,
// AEGIS asks "Are you OK?" with a 10 s countdown. "I'm OK" records a fine check-in; "Contact Earth
// now" escalates; no answer means the astronaut may not be able to respond, so AEGIS escalates on
// its own. Escalation is a real check-in, so it travels to Earth inside the PulseBrief over BPv7.
import { useEffect, useRef, useState } from "react";
import { useMission } from "@/hooks/useMission";
import { COLORS } from "@/lib/constants";

const SECONDS = 10;
type Phase = "asking" | "ok" | "escalated" | "auto";

export function EmergencyCheck() {
  const { spacecraft, actions } = useMission();
  const a = spacecraft?.latest_alert;
  const urgent = a && a.severity === "urgent" && (a.metric === "heart_rate" || a.metric === "spo2") ? a : null;
  const [state, setState] = useState<{ id: string; phase: Phase; left: number } | null>(null);
  const seen = useRef<Set<string>>(new Set());
  const first = useRef(true);
  // live telemetry re-renders every second; keep the actions stable so the countdown timer is not reset
  const act = useRef(actions);
  act.current = actions;

  // a new urgent alert starts a check (not the one already on screen when the page opens)
  useEffect(() => {
    if (!spacecraft) return;
    if (first.current) { first.current = false; if (urgent) seen.current.add(urgent.alert_id); return; }
    if (urgent && !seen.current.has(urgent.alert_id)) {
      seen.current.add(urgent.alert_id);
      setState({ id: urgent.alert_id, phase: "asking", left: SECONDS });
    }
  }, [spacecraft, urgent]);

  // countdown; at zero AEGIS escalates on its own
  useEffect(() => {
    if (state?.phase !== "asking") return;
    if (state.left <= 0) {
      setState({ ...state, phase: "auto" });
      act.current.checkin("unwell", "no response to AEGIS check");
      act.current.escalate("no_response");               // urgent PulseBrief to Earth now
      return;
    }
    const t = window.setTimeout(() => setState((s) => (s && s.phase === "asking" ? { ...s, left: s.left - 1 } : s)), 1000);
    return () => window.clearTimeout(t);
  }, [state]);

  // results fade after a while
  useEffect(() => {
    if (!state || state.phase === "asking") return;
    const t = window.setTimeout(() => setState(null), 12000);
    return () => window.clearTimeout(t);
  }, [state]);

  if (!state) return null;
  const answer = (phase: Phase) => {
    setState({ ...state, phase });
    if (phase === "ok") act.current.checkin("fine", null);
    else { act.current.checkin("unwell", "asked to contact Earth"); act.current.escalate("crew_request"); }
  };

  if (state.phase !== "asking") {
    const ok = state.phase === "ok";
    return (
      <div className="enter mb-2 rounded-lg px-3 py-2 text-[12px]" style={{ background: ok ? "rgba(63,191,127,0.12)" : "rgba(255,107,91,0.14)", color: ok ? COLORS.nominal : COLORS.warning }}>
        {ok ? "Thanks. AEGIS keeps monitoring." : state.phase === "auto" ? "No answer. AEGIS sent an urgent PulseBrief to Earth." : "Urgent PulseBrief sent to Earth. Doctors will reply."}
      </div>
    );
  }
  return (
    <div className="enter mb-2 rounded-lg p-3" style={{ background: "rgba(255,107,91,0.12)", boxShadow: `inset 0 0 0 1.5px ${COLORS.warning}` }} role="alertdialog" aria-live="assertive">
      <div className="flex items-center justify-between">
        <span className="text-[14px] font-semibold" style={{ color: COLORS.warning }}>Are you OK?</span>
        <span className="num text-[22px] leading-none font-semibold" style={{ color: COLORS.warning }}>{state.left}</span>
      </div>
      <p className="mt-1 text-[12px] leading-[17px] text-fg-2">If you don&apos;t answer, AEGIS will contact Earth automatically.</p>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full transition-[width] duration-1000 ease-linear" style={{ width: `${(state.left / SECONDS) * 100}%`, background: COLORS.warning }} />
      </div>
      <div className="mt-2.5 flex gap-1.5">
        <button onClick={() => answer("ok")} className="h-8 flex-1 rounded-lg bg-raised text-[12.5px] font-medium hover:bg-[#22272a]">I&apos;m OK</button>
        <button onClick={() => answer("escalated")} className="h-8 flex-1 rounded-lg text-[12.5px] font-semibold text-bg" style={{ background: COLORS.warning }}>Contact Earth now</button>
      </div>
    </div>
  );
}
