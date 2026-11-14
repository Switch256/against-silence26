"use client";
// One PulseBrief. Collapsed: a single row (severity, title, time, three layer dots).
// Selected: lifecycle, context, evidence and the reply box. New arrivals are briefly highlighted.
import type { ReactNode } from "react";
import type { Brief, Bundle, Reply } from "@/lib/api";
import { COLORS, LAYER_ORDER, SEVERITY } from "@/lib/constants";
import { feelingLabel, metricLabel, metricUnit, utc } from "@/lib/format";
import { isFresh, isInFlight, useStore } from "@/lib/store";
import { ProvenanceTag, StatusMark, StatusText, type StatusLevel } from "@/components/ui/Status";
import { spaceWeatherStatus } from "@/components/crew/SpaceWeather";
import { BriefTimeline } from "./BriefTimeline";
import { EvidenceChart } from "./EvidenceChart";
import { ReplyBox } from "./ReplyBox";

interface Props {
  brief: Brief;
  bundles: Bundle[];
  replies: Reply[];
  open: boolean;
  onToggle: () => void;
}

function Sub({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="px-3 pt-3">
      <div className="caps mb-1.5">{title}</div>
      {children}
    </div>
  );
}

export function BriefCard({ brief, bundles, replies, open, onToggle }: Props) {
  const flights = useStore((s) => s.flights);
  const fresh = useStore((s) => s.fresh);
  const arrived = (l: "headline" | "context" | "evidence") => !!brief.layers[l] && !isInFlight(flights, `${brief.brief_id}:${l}`);
  const has = { headline: arrived("headline"), context: arrived("context"), evidence: arrived("evidence") };
  const count = LAYER_ORDER.filter((l) => has[l]).length;
  const h = has.headline ? brief.layers.headline! : {};
  const c = has.context ? brief.layers.context : undefined;
  const ev = has.evidence ? brief.layers.evidence : undefined;
  const sevKey = h.sev ?? bundles[0]?.severity ?? "review";
  const sev = SEVERITY[sevKey];
  const level: StatusLevel = sevKey === "urgent" ? "warning" : sevKey === "review" ? "caution" : "neutral";
  const isSW = h.m === "space_weather";
  const headlineAt = bundles.find((b) => b.layer === "headline")?.delivered_at ?? brief.first_received;
  const isNew = isFresh(fresh, brief.brief_id, 8000);

  if (count === 0) {
    return <div className="rounded border border-dashed border-line-strong px-3 py-2.5 text-[13px] text-fg-3">PulseBrief incoming · headline crossing the link</div>;
  }

  return (
    <article
      key={`${brief.brief_id}-${count}`}
      className={`enter overflow-hidden rounded bg-sunken ${isNew ? "flash" : ""}`}
      style={{ boxShadow: `inset 0 0 0 1px ${open ? COLORS.lineStrong : COLORS.line}` }}
    >
      <button onClick={onToggle} className="flex w-full items-center gap-2 px-2.5 py-2 text-left hover:bg-raised/50" aria-expanded={open}>
        <span style={{ color: sev.color }}><StatusMark level={level} /></span>
        <span className="min-w-0 flex-1 truncate text-[12px]" title={`${sev.label} · ${metricLabel(h.m)}`}>
          <span className="text-fg-2">{metricLabel(h.m)} </span>
          <span className="num font-semibold">{h.val != null ? Math.round(h.val) : "–"}</span>
          <span className="text-fg-3"> {isSW ? "SEP" : metricUnit(h.m)}</span>
        </span>
        <span className="flex gap-1" title={`${count} of 3 layers received`}>
          {LAYER_ORDER.map((l) => <span key={l} className="h-1.5 w-1.5 rounded-full" style={{ background: has[l] ? COLORS.nominal : COLORS.lineStrong }} />)}
        </span>
        <span className="num w-[50px] text-right text-[11px] text-fg-3">{utc(headlineAt)}</span>
      </button>

      {open && (
        <div className="pb-3">
          <div className="flex items-center justify-between px-3 text-[12px] text-fg-3">
            <span className="num">
              {h.base != null ? `Baseline ${Math.round(h.base)} ${metricUnit(h.m)} · ` : ""}{brief.brief_id}
            </span>
            {isSW ? <ProvenanceTag value="nasa-donki" /> : <ProvenanceTag value="simulated" title="Vital signs are simulated" />}
          </div>
          <Sub title="Lifecycle"><BriefTimeline bundles={bundles} replies={replies} /></Sub>
          <Sub title="Context">
            {c ? (
              <div className="space-y-1.5">
                {c.reason && <p className="text-[13px] leading-5 text-fg-2">{c.reason}</p>}
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[12px]">
                  {c.checkin && (<><dt className="text-fg-3">Crew check-in</dt><dd>{feelingLabel(c.checkin.feeling)}{c.checkin.symptom ? ` · ${c.checkin.symptom}` : ""}</dd></>)}
                  {c.activity && (<><dt className="text-fg-3">Activity</dt><dd className="capitalize">{c.activity}{c.spo2 != null ? ` · SpO₂ ${Math.round(c.spo2)} %` : ""}</dd></>)}
                  <dt className="text-fg-3">Steps done</dt>
                  <dd>{c.done?.length ? c.done.join(" · ") : <span className="text-fg-4">none yet</span>}</dd>
                  {c.space_weather && (
                    <>
                      <dt className="text-fg-3">Space weather</dt>
                      <dd>
                        <StatusText level={spaceWeatherStatus(c.space_weather.level)} className="!font-normal">{c.space_weather.headline ?? c.space_weather.level}</StatusText>
                        {!isSW && <span className="ml-1 text-[11px] text-fg-4">· NASA DONKI{c.space_weather.mode === "replay" ? " replay" : ""}</span>}
                      </dd>
                    </>
                  )}
                </dl>
              </div>
            ) : (
              <div className="text-[12px] text-fg-4">Still on board · arrives when the link allows</div>
            )}
          </Sub>
          {(!ev || (ev.hr?.length ?? 0) > 0) && (
            <Sub title="Evidence">
              {ev ? <EvidenceChart ev={ev} base={h.base} /> : <div className="text-[12px] text-fg-4">Still on board · lowest-priority layer</div>}
            </Sub>
          )}
          <Sub title="Reply to crew"><ReplyBox briefId={brief.brief_id} replies={replies} /></Sub>
        </div>
      )}
    </article>
  );
}
