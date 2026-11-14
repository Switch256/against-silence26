"use client";
// The active AEGIS alert (NASA-STD-3001 Appendix F): class in words and shape, the actual value
// next to the baseline, and when it occurred, at a glance. The reason, where the evidence is now,
// and the "what to do now" checklist expand in place.
import { useState } from "react";
import { useMission } from "@/hooks/useMission";
import type { Alert, Bundle } from "@/lib/api";
import { COLORS, SEVERITY } from "@/lib/constants";
import { briefIdOf, metricLabel, metricUnit, utc } from "@/lib/format";
import { possibleCauses } from "@/lib/possibleCauses";
import { CheckIcon, ChevronIcon } from "@/components/ui/icons";
import { StatusMark, StatusText, type StatusLevel } from "@/components/ui/Status";

function evidenceState(alert: Alert, outbox: Bundle[]): { level: StatusLevel; text: string } {
  const ev = outbox.find((b) => b.brief_id === briefIdOf(alert.alert_id) && b.layer === "evidence");
  if (!ev) return { level: "neutral", text: "Evidence on board" };
  if (ev.delivered_at) return { level: "nominal", text: `Evidence received on Earth ${utc(ev.delivered_at)} UTC` };
  if (ev.sent_at) return { level: "neutral", text: `Evidence in transit since ${utc(ev.sent_at)} UTC` };
  return { level: "caution", text: "Evidence still on board · queued for the next contact" };
}

function Checklist({ alert }: { alert: Alert }) {
  const { actions } = useMission();
  const [pending, setPending] = useState<string | null>(null);
  return (
    <ol className="space-y-1">
      {alert.todo.map((step, i) => {
        const done = alert.done.includes(step);
        return (
          <li key={step}>
            <button
              disabled={done || pending === step}
              onClick={async () => {
                setPending(step);
                await actions.markDone(alert.alert_id, step);
                setPending(null);
              }}
              className={`flex min-h-9 w-full items-center gap-3 rounded px-2 text-left text-[13px] transition-colors ${done ? "text-fg-3" : "bg-raised hover:bg-[#252a2d]"}`}
            >
              <span
                className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[3px] border"
                style={done ? { borderColor: COLORS.nominal, color: COLORS.nominal } : { borderColor: COLORS.lineStrong }}
              >
                {done ? <CheckIcon className="h-3 w-3" /> : <span className="num text-[10px] text-fg-3">{i + 1}</span>}
              </span>
              <span className={done ? "line-through decoration-fg-4" : ""}>{step}</span>
              {pending === step && <span className="ml-auto text-[11px] text-fg-3">Saving…</span>}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

/** Possible causes with first steps (adapted from Mariam Saied's rule cards). */
function Causes({ alert, activity }: { alert: Alert; activity?: string }) {
  const causes = possibleCauses(alert, activity);
  const [open, setOpen] = useState<string | null>(null);
  if (!causes.length) return null;
  return (
    <div>
      <div className="mb-1 text-[12px] font-semibold text-fg-2">Possible causes</div>
      <ul className="space-y-1">
        {causes.map((c) => (
          <li key={c.title} className="rounded-lg bg-white/[0.03]">
            <button className="flex w-full items-center justify-between px-2.5 py-1.5 text-left text-[12px]" onClick={() => setOpen(open === c.title ? null : c.title)} aria-expanded={open === c.title}>
              <span><span className="font-medium text-fg">{c.title}</span><span className="text-fg-3"> · {c.why}</span></span>
              <ChevronIcon className={`ml-2 h-3.5 w-3.5 shrink-0 text-fg-3 transition-transform ${open === c.title ? "rotate-180" : ""}`} />
            </button>
            {open === c.title && <ol className="list-decimal space-y-0.5 pr-2.5 pb-2 pl-7 text-[12px] text-fg-2">{c.steps.map((st) => <li key={st}>{st}</li>)}</ol>}
          </li>
        ))}
      </ul>
      <p className="mt-1 text-[10.5px] text-fg-4">General wellness guidance for a simulation, not medical advice.</p>
    </div>
  );
}

export function ActiveAlert() {
  const { spacecraft } = useMission();
  const a = spacecraft?.latest_alert;
  const [openId, setOpenId] = useState<string | null>(null);
  if (!a) {
    return (
      <div className="text-[12px]">
        <StatusText level="nominal">No active alerts</StatusText>
        <span className="ml-1 text-[11px] text-fg-3">· compared with this astronaut&apos;s own baseline</span>
      </div>
    );
  }
  const open = openId === a.alert_id;
  const sev = SEVERITY[a.severity];
  const level: StatusLevel = a.severity === "urgent" ? "warning" : a.severity === "review" ? "caution" : "neutral";
  const isSW = a.metric === "space_weather";
  const unit = metricUnit(a.metric);
  const delta = a.baseline != null ? a.value - a.baseline : null;
  const left = a.todo.filter((t) => !a.done.includes(t)).length;
  const ev = evidenceState(a, spacecraft?.outbox ?? []);
  // when AEGIS raised it on board (wall clock); the reading time is on the simulator's clock
  const detected = (spacecraft?.outbox ?? []).find((b) => b.brief_id === briefIdOf(a.alert_id))?.created ?? a.ts;

  return (
    <div key={a.alert_id} className="enter overflow-hidden rounded-lg border bg-sunken" style={{ borderColor: sev.color }}>  {/* severity colour: meaning, not decoration */}
      <button className="block w-full px-3 py-2 text-left" onClick={() => setOpenId(open ? null : a.alert_id)} aria-expanded={open}>
        <div className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-1.5 text-[12px] font-semibold" style={{ color: sev.color }}>
            <StatusMark level={level} className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{sev.label} · {metricLabel(a.metric)}</span>
          </span>
          <span className="num shrink-0 text-[11px] text-fg-3" title={`detected on board, UTC${a.ts ? ` · reading time (simulator clock) ${utc(a.ts)}` : ""}`}>{detected ? utc(detected) : ""}</span>
        </div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="num text-[20px] leading-none font-semibold">{Math.round(a.value)}</span>
          <span className="truncate text-[12px] text-fg-3">{isSW ? `solar particle event${Math.round(a.value) === 1 ? "" : "s"} · NASA DONKI` : unit}</span>
          {a.baseline != null && (
            <span className="num text-[12px] text-fg-2">
              vs baseline {Math.round(a.baseline)}{delta != null && <span className="text-fg"> ({delta >= 0 ? "+" : "−"}{Math.abs(Math.round(delta))})</span>}
            </span>
          )}
        </div>
        <div className="mt-1 flex items-center justify-between text-[11px] text-fg-3">
          <span>{left ? `${left} of ${a.todo.length} steps to do` : "All steps done"}</span>
          <span className="flex items-center gap-1 text-fg-2">
            {open ? "Hide" : "What to do now"} <ChevronIcon className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
          </span>
        </div>
      </button>
      {open && (
        <div className="enter space-y-2.5 px-3 pb-3">
          <p className="text-[13px] leading-5 text-fg-2">{a.reason}</p>
          <div className="text-[12px]"><StatusText level={ev.level} className="!font-normal">{ev.text}</StatusText></div>
          <Checklist alert={a} />
          <Causes alert={a} activity={spacecraft?.readings.at(-1)?.activity} />
        </div>
      )}
    </div>
  );
}
