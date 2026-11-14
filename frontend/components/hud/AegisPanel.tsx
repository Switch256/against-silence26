"use client";
// Astronaut side: the AEGIS alert with "what to do now" steps, the 3-tap check-in,
// when Earth will see it, and replies that have arrived from Earth.
import { useState } from "react";
import { useMission } from "@/hooks/useMission";
import type { Feeling } from "@/lib/api";
import { COLORS } from "@/lib/constants";
import { metricLabel, metricUnit } from "@/lib/format";
import { isInFlight, useStore } from "@/lib/store";
import { CheckIcon } from "./icons";
import { Panel } from "./Panel";

const FEELINGS: { id: Feeling; label: string; color: string }[] = [
  { id: "fine", label: "Fine", color: "#2fe39a" },
  { id: "a_bit_off", label: "A bit off", color: "#ffb020" },
  { id: "unwell", label: "Unwell", color: "#ff3b4f" },
];
const SYMPTOMS = ["dizzy", "headache", "nausea", "chest pain"];

function AlertCard() {
  const { spacecraft, actions } = useMission();
  const [pending, setPending] = useState<string | null>(null);
  const a = spacecraft?.latest_alert;
  if (!a) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-reply/20 bg-reply/[0.06] px-3 py-2.5">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-reply/15 text-reply">
          <CheckIcon className="h-4 w-4" />
        </span>
        <div className="leading-tight">
          <div className="text-[13px] font-medium">All nominal</div>
          <div className="text-[11px] text-dim">AEGIS is comparing every reading to this astronaut&apos;s own baseline.</div>
        </div>
      </div>
    );
  }
  const color = COLORS[a.severity];
  return (
    <div key={a.alert_id} className="rise-in relative overflow-hidden rounded-xl border bg-black/20" style={{ borderColor: `${color}55` }}>
      <div className="absolute inset-y-0 left-0 w-1" style={{ background: color, boxShadow: `0 0 14px ${color}` }} />
      <div className="py-2.5 pr-3 pl-4">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10.5px] font-semibold tracking-[0.18em] uppercase" style={{ color }}>
            {a.severity} · {metricLabel(a.metric)}
          </span>
          <span className="font-mono text-[11px] tabular-nums text-dim">
            <b className="text-ink">{Math.round(a.value)}</b> {metricUnit(a.metric)}
            {a.baseline != null && <> · normal {Math.round(a.baseline)}</>}
          </span>
        </div>
        <p className="mt-1.5 text-[12.5px] leading-snug text-ink/85">{a.reason}</p>
        <div className="label mt-2.5 mb-1.5 !text-[9px]">What to do now</div>
        <ul className="space-y-0.5">
          {a.todo.map((step) => {
            const done = a.done.includes(step);
            return (
              <li key={step}>
                <button
                  disabled={done || pending === step}
                  onClick={async () => {
                    setPending(step);
                    await actions.markDone(a.alert_id, step);
                    setPending(null);
                  }}
                  className={`group flex w-full items-center gap-2.5 rounded-lg px-2 py-1 text-left text-[12.5px] transition-colors ${done ? "text-dim" : "hover:bg-white/5"}`}
                >
                  <span
                    className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md border transition-all ${done ? "border-reply bg-reply/20 text-reply" : "border-white/25 group-hover:border-white/50"}`}
                  >
                    {done && <CheckIcon className="h-3 w-3" />}
                    {pending === step && <span className="h-2 w-2 animate-pulse rounded-full bg-white/60" />}
                  </span>
                  <span className={done ? "line-through decoration-white/30" : ""}>{step}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function CheckIn() {
  const { spacecraft, actions } = useMission();
  const [symptom, setSymptom] = useState<string | null>(null);
  const [sending, setSending] = useState<Feeling | null>(null);
  const current = spacecraft?.checkin;

  const send = async (f: Feeling, s: string | null) => {
    setSending(f);
    await actions.checkin(f, s);
    setSending(null);
  };

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="label !text-[9px]">How do you feel?</span>
        {current && (
          <span className="font-mono text-[10px] text-faint">
            sent: {FEELINGS.find((f) => f.id === current.feeling)?.label}
            {current.symptom ? ` · ${current.symptom}` : ""}
          </span>
        )}
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {FEELINGS.map((f) => {
          const on = current?.feeling === f.id;
          return (
            <button
              key={f.id}
              onClick={() => send(f.id, f.id === "fine" ? null : symptom)}
              className="flex h-12 flex-col items-center justify-center gap-1 rounded-xl border text-[12px] font-medium transition-all"
              style={{
                borderColor: on ? f.color : "rgba(130,200,255,0.13)",
                background: on ? `${f.color}1f` : "rgba(18,30,54,0.45)",
                boxShadow: on ? `0 0 18px ${f.color}33, inset 0 0 12px ${f.color}22` : undefined,
              }}
            >
              <span className={`h-2 w-2 rounded-full ${sending === f.id ? "animate-ping" : ""}`} style={{ background: f.color, boxShadow: `0 0 8px ${f.color}` }} />
              {f.label}
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {SYMPTOMS.map((s) => (
          <button
            key={s}
            onClick={() => setSymptom(symptom === s ? null : s)}
            className={`rounded-full border px-2.5 py-0.5 text-[11px] transition-colors ${symptom === s ? "border-amber/70 bg-amber/15 text-amber" : "border-white/10 text-dim hover:border-white/25"}`}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function Eta() {
  const sc = useStore((s) => s.spacecraft);
  if (!sc) return null;
  const up = sc.eta.link_up;
  return (
    <div className="grid grid-cols-2 gap-2">
      {[
        { k: "Earth sees it in", v: sc.eta.earth_sees_in_min, c: up ? "#38e1ff" : "#ffb020" },
        { k: "Earliest reply in", v: sc.eta.earliest_reply_in_min, c: "#2fe39a" },
      ].map(({ k, v, c }) => (
        <div key={k} className="rounded-xl border border-white/5 bg-black/20 px-3 py-2">
          <div className="label !text-[9px]">{k}</div>
          <div className="font-mono text-[22px] leading-tight tabular-nums" style={{ color: c }}>
            ~{Math.round(v)}
            <span className="ml-1 text-[11px] text-dim">min</span>
          </div>
        </div>
      ))}
      <div className="col-span-2 -mt-0.5 font-mono text-[10px] text-faint">
        {up ? "Link up · light-time delay only" : "Link down · waiting for the next contact window"}
      </div>
    </div>
  );
}

function Replies() {
  const sc = useStore((s) => s.spacecraft);
  const flights = useStore((s) => s.flights);
  const replies = (sc?.replies ?? []).filter((r) => !isInFlight(flights, r.reply_id));
  if (!replies.length) {
    return <div className="rounded-xl border border-dashed border-white/10 px-3 py-2.5 text-[11.5px] text-faint">No messages from Earth yet.</div>;
  }
  return (
    <ul className="space-y-1.5">
      {replies.slice(0, 4).map((r, i) => (
        <li key={r.reply_id} className={`rise-in rounded-xl border px-3 py-2 ${i === 0 ? "border-reply/40 bg-reply/[0.08]" : "border-white/5 bg-black/15"}`}>
          <div className="flex items-center justify-between">
            <span className="font-mono text-[9.5px] tracking-[0.14em] text-reply uppercase">{r.author}</span>
            <span className="font-mono text-[9.5px] text-faint">via BPv7</span>
          </div>
          <p className="mt-0.5 text-[12.5px] leading-snug">{r.text}</p>
        </li>
      ))}
    </ul>
  );
}

export function AegisPanel() {
  return (
    <Panel title="AEGIS" kicker="onboard guidance · rules + statistics" bodyClassName="scroll-thin space-y-3.5 overflow-y-auto" className="flex-1">
      <AlertCard />
      <Eta />
      <CheckIn />
      <div>
        <div className="label mb-1.5 !text-[9px]">Messages from Earth</div>
        <Replies />
      </div>
    </Panel>
  );
}
