"use client";
// Three-tap check-in in one row, with an optional symptom.
import { useState } from "react";
import { useMission } from "@/hooks/useMission";
import type { Feeling } from "@/lib/api";
import { feelingLabel } from "@/lib/format";

const FEELINGS: Feeling[] = ["fine", "a_bit_off", "unwell"];
const SYMPTOMS = ["dizzy", "headache", "nausea", "chest pain"];

export function CheckIn() {
  const { spacecraft, actions } = useMission();
  const [symptom, setSymptom] = useState("");
  const [sending, setSending] = useState<Feeling | null>(null);
  const current = spacecraft?.checkin;

  const send = async (f: Feeling) => {
    setSending(f);
    await actions.checkin(f, f === "fine" || !symptom ? null : symptom);
    setSending(null);
  };

  return (
    <div>
      <div className="flex gap-1">
        {FEELINGS.map((f) => {
          const on = current?.feeling === f;
          return (
            <button
              key={f}
              onClick={() => send(f)}
              aria-pressed={on}
              className={`h-7 min-w-0 flex-1 whitespace-nowrap rounded border px-1 text-[11px] font-medium transition-colors ${on ? "border-accent bg-[#1d2a3a] text-fg" : "border-line-strong bg-raised text-fg-2 hover:text-fg"}`}
            >
              {sending === f ? "Sending…" : feelingLabel(f)}
            </button>
          );
        })}
        <select
          value={symptom}
          onChange={(e) => setSymptom(e.target.value)}
          aria-label="Symptom"
          className="h-7 w-[78px] shrink-0 rounded border border-line-strong bg-raised px-1 text-[11px] text-fg-2 outline-none focus:border-accent"
        >
          <option value="">Symptom…</option>
          {SYMPTOMS.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
        </select>
      </div>
      {current?.symptom && (
        <div className="mt-1 text-[11px] text-fg-3">Symptom sent: <span className="text-fg-2">{current.symptom}</span></div>
      )}
    </div>
  );
}
