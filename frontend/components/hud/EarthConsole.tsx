"use client";
// Earth side: PulseBriefs as they arrive layer by layer, and the doctor's reply.
import { useMemo, useState } from "react";
import { useMission } from "@/hooks/useMission";
import type { Brief, Evidence, Layer, Reply } from "@/lib/api";
import { COLORS, DSN_STATIONS, LAYER_LABEL, LAYER_ORDER } from "@/lib/constants";
import { feelingLabel, metricLabel, metricUnit, timeHM } from "@/lib/format";
import { isInFlight, servingStation, useStore } from "@/lib/store";
import { SendIcon } from "./icons";
import { Panel } from "./Panel";

const QUICK_REPLIES = ["Rest 15 min, then re-measure.", "Drink 500 ml water and report back.", "Seen. Keep monitoring, we are with you."];

function LayerPips({ has }: { has: Record<Layer, boolean> }) {
  return (
    <div className="flex gap-1">
      {LAYER_ORDER.map((l) => {
        const on = has[l];
        const c = COLORS[l];
        return (
          <div key={l} className="flex-1">
            <div
              className="h-1.5 rounded-full transition-all duration-700"
              style={{ background: on ? c : "rgba(130,200,255,0.1)", boxShadow: on ? `0 0 10px ${c}` : undefined }}
            />
            <div className="mt-1 font-mono text-[9px] tracking-[0.12em] uppercase" style={{ color: on ? c : "#4f6582" }}>
              {LAYER_LABEL[l]}
              {!on && " ···"}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function EvidenceChart({ ev, base }: { ev: Evidence; base?: number }) {
  const data = ev.hr ?? [];
  const chart = useMemo(() => {
    if (data.length < 2) return null;
    const W = 320;
    const H = 70;
    const xs = data.map((d) => d[0]);
    const ys = data.map((d) => d[1]);
    const x0 = Math.min(...xs);
    const x1 = Math.max(...xs, 1);
    const lo = Math.min(...ys, base ?? Infinity) - 5;
    const hi = Math.max(...ys) + 5;
    const X = (x: number) => ((x - x0) / (x1 - x0)) * W;
    const Y = (y: number) => H - ((y - lo) / (hi - lo)) * H;
    const path = data.map(([x, y], i) => `${i ? "L" : "M"}${X(x).toFixed(1)},${Y(y).toFixed(1)}`).join("");
    return { W, H, path, area: `${path}L${X(x1)},${H}L${X(x0)},${H}Z`, ex: X(0), by: base != null ? Y(base) : null, lo, hi };
  }, [data, base]);
  if (!chart) return null;
  return (
    <div className="rise-in">
      <div className="mb-1 flex justify-between font-mono text-[9px] text-faint">
        <span>Evidence · heart rate around the event</span>
        <span>{data.length} pts</span>
      </div>
      <svg viewBox={`0 0 ${chart.W} ${chart.H}`} preserveAspectRatio="none" className="h-[70px] w-full overflow-visible rounded-md bg-black/20">
        <defs>
          <linearGradient id="evFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={COLORS.evidence} stopOpacity="0.35" />
            <stop offset="1" stopColor={COLORS.evidence} stopOpacity="0" />
          </linearGradient>
        </defs>
        {chart.by != null && (
          <line x1="0" x2={chart.W} y1={chart.by} y2={chart.by} stroke="#8aa0bd" strokeOpacity="0.5" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />
        )}
        <line x1={chart.ex} x2={chart.ex} y1="0" y2={chart.H} stroke={COLORS.headline} strokeOpacity="0.7" vectorEffect="non-scaling-stroke" />
        <path d={chart.area} fill="url(#evFill)" />
        <path d={chart.path} fill="none" stroke="#7fb2ff" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="mt-0.5 flex justify-between font-mono text-[9px] text-faint">
        <span>{Math.round(data[0][0])} s</span>
        <span className="text-headline">event</span>
        <span>{Math.round(data[data.length - 1][0])} s</span>
      </div>
    </div>
  );
}

function ReplyBox({ briefId, replies }: { briefId: string; replies: Reply[] }) {
  const { actions } = useMission();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const send = async (t: string) => {
    if (!t.trim()) return;
    setSending(true);
    await actions.reply(briefId, t.trim());
    setText("");
    setSending(false);
  };
  return (
    <div className="space-y-2">
      {replies.map((r) => (
        <div key={r.reply_id} className="flex items-start gap-2 rounded-lg border border-reply/25 bg-reply/[0.06] px-2.5 py-1.5">
          <SendIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-reply" />
          <div className="min-w-0 flex-1">
            <p className="text-[12px] leading-snug">{r.text}</p>
            <div className="font-mono text-[9.5px] tracking-[0.1em] uppercase" style={{ color: r.status === "queued" ? COLORS.window : COLORS.reply }}>
              {r.status === "queued" ? "queued · waiting for link" : r.status === "in_transit" ? "in transit to crew" : "delivered to crew"}
            </div>
          </div>
        </div>
      ))}
      <div className="flex flex-wrap gap-1">
        {QUICK_REPLIES.map((q) => (
          <button key={q} disabled={sending} onClick={() => send(q)} className="rounded-full border border-white/10 px-2 py-0.5 text-[10.5px] text-dim transition-colors hover:border-reply/50 hover:text-reply">
            {q}
          </button>
        ))}
      </div>
      <form
        className="flex gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          send(text);
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={500}
          placeholder="Reply to the crew…"
          className="h-9 min-w-0 flex-1 rounded-lg border border-white/10 bg-black/30 px-3 text-[12.5px] outline-none focus:border-reply/50"
        />
        <button type="submit" disabled={sending || !text.trim()} className="btn !h-9 !border-reply/40 !bg-reply/15 !px-3 text-reply">
          <SendIcon className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}

function BriefCard({ brief, replies, open, onToggle }: { brief: Brief; replies: Reply[]; open: boolean; onToggle: () => void }) {
  const flights = useStore((s) => s.flights);
  const has = {
    headline: !!brief.layers.headline && !isInFlight(flights, `${brief.brief_id}:headline`),
    context: !!brief.layers.context && !isInFlight(flights, `${brief.brief_id}:context`),
    evidence: !!brief.layers.evidence && !isInFlight(flights, `${brief.brief_id}:evidence`),
  };
  if (!has.headline && !has.context && !has.evidence) {
    // Known to the backend but its first packet is still crossing on screen.
    return (
      <div className="flex items-center gap-3 rounded-xl border border-dashed border-headline/40 bg-headline/[0.05] px-3 py-3">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inset-0 animate-ping rounded-full bg-headline/70" />
          <span className="relative h-2.5 w-2.5 rounded-full bg-headline" />
        </span>
        <div className="leading-tight">
          <div className="font-mono text-[10.5px] tracking-[0.16em] text-headline uppercase">PulseBrief incoming</div>
          <div className="text-[11.5px] text-dim">Headline crossing the link…</div>
        </div>
      </div>
    );
  }
  const h = has.headline ? brief.layers.headline! : {};
  const c = has.context ? brief.layers.context : undefined;
  const ev = has.evidence ? brief.layers.evidence : undefined;
  const sev = h.sev ?? "review";
  const color = COLORS[sev];

  return (
    <article className="rise-in relative overflow-hidden rounded-xl border bg-black/25" style={{ borderColor: `${color}40` }}>
      <div className="absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />
      <button onClick={onToggle} className="block w-full px-3 pt-2.5 pb-2 text-left">
        <div className="flex items-center justify-between">
          <span className="rounded px-1.5 py-0.5 font-mono text-[9.5px] font-semibold tracking-[0.18em] uppercase" style={{ color, background: `${color}1c` }}>
            {sev}
          </span>
          <span className="font-mono text-[9.5px] text-faint">
            {brief.brief_id} · {timeHM(brief.first_received)} UTC
          </span>
        </div>
        <div className="mt-1.5 flex items-baseline gap-2">
          <span className="text-[13px] text-dim">{metricLabel(h.m)}</span>
          <span className="font-mono text-[24px] leading-none tabular-nums" style={{ color }}>
            {h.val != null ? Math.round(h.val) : "–"}
          </span>
          <span className="font-mono text-[11px] text-dim">{metricUnit(h.m)}</span>
          {h.base != null && <span className="ml-auto font-mono text-[11px] text-faint">normal {Math.round(h.base)}</span>}
        </div>
        <div className="mt-2">
          <LayerPips has={has} />
        </div>
      </button>
      {open && (
        <div className="space-y-2.5 border-t border-white/5 px-3 pt-2.5 pb-3">
          {c ? (
            <div className="rise-in space-y-2">
              {c.reason && <p className="text-[12.5px] leading-snug text-ink/85">{c.reason}</p>}
              <div className="flex flex-wrap gap-1.5">
                {c.checkin && (
                  <span className="rounded-full border border-amber/40 bg-amber/10 px-2 py-0.5 text-[11px] text-amber">
                    Crew says: {feelingLabel(c.checkin.feeling)}
                    {c.checkin.symptom ? ` · ${c.checkin.symptom}` : ""}
                  </span>
                )}
                {c.activity && <span className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-dim capitalize">{c.activity}</span>}
                {c.spo2 != null && <span className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-dim">SpO₂ {Math.round(c.spo2)}%</span>}
                {(c.done ?? []).map((d) => (
                  <span key={d} className="rounded-full border border-reply/35 bg-reply/10 px-2 py-0.5 text-[11px] text-reply">
                    ✓ {d}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-context/30 px-3 py-2 font-mono text-[10.5px] text-context/80">
              Context still on board · arrives when the link allows
            </div>
          )}
          {ev ? (
            <EvidenceChart ev={ev} base={h.base} />
          ) : (
            <div className="rounded-lg border border-dashed border-evidence/30 px-3 py-2 font-mono text-[10.5px] text-evidence/90">Evidence pending · lowest priority layer</div>
          )}
          <ReplyBox briefId={brief.brief_id} replies={replies} />
        </div>
      )}
    </article>
  );
}

export function EarthConsole() {
  const earth = useStore((s) => s.earth);
  const mission = useStore((s) => s.mission);
  const [openId, setOpenId] = useState<string | null>(null);
  const station = DSN_STATIONS.find((s) => s.id === servingStation(mission))!;
  const briefs = earth?.briefs ?? [];
  const current = openId ?? briefs[0]?.brief_id ?? null;

  return (
    <Panel
      title="Earth · Medical console"
      kicker={`DSN ${station.name}`}
      right={<span className="font-mono text-[10px] text-dim">{briefs.length} brief{briefs.length === 1 ? "" : "s"}</span>}
      className="h-full"
      bodyClassName="scroll-thin space-y-2.5 overflow-y-auto"
    >
      {briefs.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <div className="relative h-20 w-20">
            {[0, 1, 2].map((i) => (
              <span key={i} className="absolute inset-0 animate-ping rounded-full border border-link/30" style={{ animationDelay: `${i * 0.6}s`, animationDuration: "2.4s" }} />
            ))}
            <span className="absolute inset-[34%] rounded-full bg-link/40 shadow-[0_0_20px_#38e1ff]" />
          </div>
          <div className="text-[13px]">Listening for PulseBriefs</div>
          <div className="max-w-[240px] text-[11.5px] text-faint">Alerts arrive in three layers: headline first, then context, then evidence.</div>
        </div>
      ) : (
        briefs.map((b) => (
          <BriefCard
            key={b.brief_id}
            brief={b}
            replies={(earth?.replies ?? []).filter((r) => r.brief_id === b.brief_id)}
            open={current === b.brief_id}
            onToggle={() => setOpenId(current === b.brief_id ? "__none__" : b.brief_id)}
          />
        ))
      )}
    </Panel>
  );
}
