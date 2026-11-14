"use client";
// Crew record: the (fictional) crew roster with flags, the monitored astronaut's profile and personal
// baselines, every measurement at its time (raw, or averaged per minute / 10 minutes), the alerts and
// check-ins in the same range, and exports (CSV per dataset, JSON for everything).
// Offline (GitHub Pages) it falls back to the readings already in the browser.
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, type CrewHistory, type CrewProfile, type ExportDataset, type HistoryRow } from "@/lib/api";
import { COLORS, SEVERITY } from "@/lib/constants";
import { feelingLabel, utc, utcDate } from "@/lib/format";
import { useStore } from "@/lib/store";
import { flagOf, useCrew } from "@/hooks/useCrew";
import { CloseIcon, DownloadIcon } from "@/components/ui/icons";

const RANGES = [
  { id: "15m", label: "15 min", s: 15 * 60, step: 0 },
  { id: "1h", label: "1 hour", s: 3600, step: 0 },
  { id: "6h", label: "6 hours", s: 6 * 3600, step: 60 },
  { id: "24h", label: "24 hours", s: 86400, step: 600 },
  { id: "all", label: "All", s: 0, step: 600 },
] as const;
const STEPS = [
  { s: 0, label: "Each reading" },
  { s: 60, label: "1 min avg" },
  { s: 600, label: "10 min avg" },
] as const;
const PAGE = 300;

type RangeId = (typeof RANGES)[number]["id"];

const bmi = (p: CrewProfile) => (p.height_cm && p.mass_kg ? (p.mass_kg / (p.height_cm / 100) ** 2).toFixed(1) : null);
const hrColor = (hr: number) => (hr >= 140 || hr <= 40 ? COLORS.warning : hr >= 110 ? COLORS.caution : COLORS.fg);
const spo2Color = (v: number | null | undefined) => (v == null ? COLORS.fg4 : v < 90 ? COLORS.warning : v < 94 ? COLORS.caution : COLORS.fg);

function Field({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-[3px] text-[12.5px]">
      <span className="text-fg-3">{k}</span>
      <span className="num text-right text-fg">{v ?? "—"}</span>
    </div>
  );
}

/** Heart rate over the loaded rows, oldest left, with alert marks. */
function Trend({ rows, alerts }: { rows: HistoryRow[]; alerts: CrewHistory["alerts"] }) {
  const pts = useMemo(() => [...rows].reverse(), [rows]);
  if (pts.length < 2) return null;
  const t0 = Date.parse(pts[0].ts);
  const t1 = Date.parse(pts.at(-1)!.ts);
  const span = Math.max(1, t1 - t0);
  const lo = Math.min(50, ...pts.map((p) => p.heart_rate_min ?? p.heart_rate));
  const hi = Math.max(150, ...pts.map((p) => p.heart_rate_max ?? p.heart_rate));
  const W = 1000, H = 120;
  const x = (ts: string) => ((Date.parse(ts) - t0) / span) * W;
  const y = (v: number) => H - ((v - lo) / (hi - lo)) * H;
  const line = pts.map((p, i) => `${i ? "L" : "M"}${x(p.ts).toFixed(1)},${y(p.heart_rate).toFixed(1)}`).join("");
  const band = pts[0].heart_rate_min != null
    ? `M${pts.map((p) => `${x(p.ts)},${y(p.heart_rate_max!)}`).join("L")}L${[...pts].reverse().map((p) => `${x(p.ts)},${y(p.heart_rate_min!)}`).join("L")}Z`
    : null;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-[96px] w-full" aria-label="Heart rate over the selected range">
      {[60, 100, 140].map((v) => (
        <g key={v}>
          <line x1={0} x2={W} y1={y(v)} y2={y(v)} stroke={COLORS.line} strokeWidth={1} vectorEffect="non-scaling-stroke" />
        </g>
      ))}
      {band && <path d={band} fill={COLORS.accent} opacity={0.14} />}
      <path d={line} fill="none" stroke={COLORS.accent} strokeWidth={1.4} vectorEffect="non-scaling-stroke" />
      {alerts.filter((a) => a.metric !== "space_weather").map((a) => {
        const t = Date.parse(a.ts);
        if (t < t0 || t > t1) return null;
        return <line key={a.alert_id} x1={x(a.ts)} x2={x(a.ts)} y1={0} y2={H} stroke={SEVERITY[a.severity].color} strokeWidth={1.5} vectorEffect="non-scaling-stroke" opacity={0.8} />;
      })}
    </svg>
  );
}

/** Build a CSV from rows in the browser (offline fallback). */
function downloadLocal(name: string, cols: string[], rows: object[], aid: string) {
  const esc = (v: unknown) => (v == null ? "" : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  const csv = [`# AEGIS-MEDLINK crew record export: ${aid} (SIMULATED data, not a medical device; offline copy)`, ["astronaut_id", ...cols].join(","),
    ...rows.map((r) => [aid, ...cols.map((c) => esc((r as Record<string, unknown>)[c]))].join(","))].join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function CrewRecord() {
  const open = useStore((s) => s.crewOpen);
  const setOpen = useStore((s) => s.setCrewOpen);
  const online = useStore((s) => s.online && !s.demoFallback);
  const crew = useCrew(open);
  const [selected, setSelected] = useState("crew-01");
  const [range, setRange] = useState<RangeId>("15m");
  const [step, setStep] = useState(0);
  const [hist, setHist] = useState<CrewHistory | null>(null);
  const [loading, setLoading] = useState(false);

  const start = useMemo(() => {
    const r = RANGES.find((x) => x.id === range)!;
    return r.s ? new Date(Date.now() - r.s * 1000).toISOString() : undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, open]);

  const load = useCallback(async (before?: string | null) => {
    setLoading(true);
    try {
      const h = await api.crewHistory({ start, step_s: step, limit: PAGE, before });
      setHist((prev) => (before && prev ? { ...h, readings: [...prev.readings, ...h.readings] } : h));
    } catch {
      // offline: what the browser already holds
      const sc = useStore.getState().spacecraft;
      const rows = [...(sc?.readings ?? [])].reverse();
      setHist({ total_readings: rows.length, step_s: 0, readings: rows, alerts: (sc?.alerts ?? []).filter((a) => a.ts) as CrewHistory["alerts"], checkins: sc?.checkin ? [sc.checkin as never] : [], next_before: null });
    } finally {
      setLoading(false);
    }
  }, [start, step]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  if (!open || !crew) return null;
  const me = crew.crew.find((c) => c.astronaut_id === selected) ?? crew.profile;
  const monitored = me.monitored;
  const aid = crew.profile.astronaut_id;

  const alertIn = (row: HistoryRow) => {
    const t = Date.parse(row.ts);
    const w = (hist?.step_s || 1) * 1000;
    return hist?.alerts.find((a) => a.metric !== "space_weather" && Date.parse(a.ts) >= t && Date.parse(a.ts) < t + w);
  };

  const exportData = (dataset: ExportDataset, format: "csv" | "json") => {
    if (online) {
      const a = document.createElement("a");
      a.href = api.crewExportUrl(dataset, format, start);
      a.download = "";
      a.click();
      return;
    }
    const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
    if (dataset === "alerts") downloadLocal(`aegis-${aid}-alerts-${stamp}.csv`, ["ts", "alert_id", "metric", "value", "baseline", "severity", "reason"], hist?.alerts ?? [], aid);
    else downloadLocal(`aegis-${aid}-readings-${stamp}.csv`, ["ts", "heart_rate", "spo2", "activity", "signal_quality", "source"], hist?.readings ?? [], aid);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/55 px-4 pt-[56px] pb-4" onClick={() => setOpen(false)}>
      <section
        className="enter flex h-full max-h-[860px] w-full max-w-[1180px] flex-col overflow-hidden rounded-[14px] bg-surface shadow-[0_24px_64px_rgba(0,0,0,0.55)]"
        onClick={(e) => e.stopPropagation()}
        aria-label="Crew record"
      >
        <header className="panel-header">
          <div className="flex items-baseline gap-2">
            <h2 className="panel-title">Crew record</h2>
            <span className="text-[12px] text-fg-3">{me.mission} · fictional crew · simulated data</span>
          </div>
          <button className="btn btn-quiet !px-2" onClick={() => setOpen(false)} aria-label="Close"><CloseIcon className="h-4 w-4" /></button>
        </header>

        {/* roster */}
        <div className="grid grid-cols-1 gap-2 px-4 pb-3 sm:grid-cols-3">
          {crew.crew.map((c) => {
            const on = c.astronaut_id === selected;
            return (
              <button
                key={c.astronaut_id}
                onClick={() => setSelected(c.astronaut_id)}
                className="flex items-center gap-3 rounded-[10px] px-3 py-2 text-left transition-colors"
                style={{ background: on ? "rgba(91,155,255,0.14)" : "rgba(255,255,255,0.03)" }}
                aria-pressed={on}
              >
                <span className="text-[26px] leading-none" aria-label={c.nationality} title={c.nationality}>{flagOf(c.country_code)}</span>
                <span className="min-w-0">
                  <span className="block truncate text-[13.5px] font-semibold text-fg">{c.name}</span>
                  <span className="block truncate text-[11.5px] text-fg-3">{c.role} · {c.age} · {c.nationality}</span>
                </span>
                {c.monitored && <span className="tag ml-auto shrink-0" style={{ color: COLORS.nominal }}>Live</span>}
              </button>
            );
          })}
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 px-4 pb-4 md:grid-cols-[290px_1fr]">
          {/* profile */}
          <aside className="scroll-thin min-h-0 overflow-y-auto rounded-[12px] bg-white/[0.025] px-4 py-3">
            <div className="flex items-center gap-3 pb-2">
              <span className="text-[40px] leading-none">{flagOf(me.country_code)}</span>
              <div>
                <div className="text-[17px] font-semibold tracking-tight">{me.name}</div>
                <div className="text-[12px] text-fg-3">{me.astronaut_id} · {me.role}</div>
              </div>
            </div>
            <div className="caps mt-2 mb-1 text-fg-2">Personal</div>
            <Field k="Age" v={me.age != null ? `${me.age} years` : null} />
            <Field k="Sex" v={me.sex} />
            <Field k="Nationality" v={<>{flagOf(me.country_code)} {me.nationality}</>} />
            <Field k="Role" v={me.role} />
            <div className="caps mt-3 mb-1 text-fg-2">Medical</div>
            <Field k="Height" v={me.height_cm ? `${me.height_cm} cm` : null} />
            <Field k="Mass" v={me.mass_kg ? `${me.mass_kg} kg` : null} />
            <Field k="BMI" v={bmi(me)} />
            <Field k="Blood type" v={me.blood_type} />
            <Field k="Allergies" v={<span style={{ color: me.allergies && !/none/i.test(me.allergies) ? COLORS.caution : undefined }}>{me.allergies}</span>} />
            <Field k="Medications" v={me.medications} />
            {monitored ? (
              <>
                <div className="caps mt-3 mb-1 text-fg-2">Monitoring</div>
                <Field k="Sensor" v={<span className="text-[11.5px]">{me.sensor}</span>} />
                <Field k="Sampling" v={me.sampling} />
                <Field k="Resting heart rate" v={crew.baseline.heart_rate_rest != null ? `${crew.baseline.heart_rate_rest} bpm` : null} />
                <Field k="Resting SpO₂" v={crew.baseline.spo2_rest != null ? `${crew.baseline.spo2_rest} %` : null} />
                <Field k="Readings on record" v={crew.record.readings.toLocaleString()} />
                <Field k="Since" v={crew.record.first ? `${utcDate(crew.record.first)} UTC` : null} />
                <Field k="Alerts" v={`${crew.record.alerts.urgent ?? 0} warning · ${crew.record.alerts.review ?? 0} caution`} />
                <Field k="Last check-in" v={crew.record.last_checkin ? `${feelingLabel(crew.record.last_checkin.feeling)} · ${utc(crew.record.last_checkin.ts)}` : null} />
              </>
            ) : (
              <p className="mt-3 text-[12.5px] leading-[1.5] text-fg-3">No wearable on this crew member in the demo. Only {crew.profile.name} is monitored live.</p>
            )}
          </aside>

          {/* measurements */}
          <div className="flex min-h-0 flex-col rounded-[12px] bg-white/[0.025]">
            {monitored ? (
              <>
                <div className="flex flex-wrap items-center gap-2 px-4 pt-3">
                  <div className="seg" role="group" aria-label="Time range">
                    {RANGES.map((r) => (
                      <button key={r.id} aria-pressed={range === r.id} onClick={() => { setRange(r.id); setStep(r.step); }}>{r.label}</button>
                    ))}
                  </div>
                  <div className="seg" role="group" aria-label="Resolution">
                    {STEPS.map((s) => (
                      <button key={s.s} aria-pressed={step === s.s} onClick={() => setStep(s.s)}>{s.label}</button>
                    ))}
                  </div>
                  <div className="ml-auto flex flex-wrap items-center gap-1.5">
                    <span className="mr-1 text-[12px] text-fg-3">Export</span>
                    <button className="btn !h-7 !px-2.5 text-[12px]" onClick={() => exportData("readings", "csv")}><DownloadIcon className="h-3.5 w-3.5" /> Readings CSV</button>
                    <button className="btn !h-7 !px-2.5 text-[12px]" onClick={() => exportData("alerts", "csv")}><DownloadIcon className="h-3.5 w-3.5" /> Alerts CSV</button>
                    {online && <button className="btn !h-7 !px-2.5 text-[12px]" onClick={() => exportData("checkins", "csv")}><DownloadIcon className="h-3.5 w-3.5" /> Check-ins CSV</button>}
                    {online && <button className="btn !h-7 !px-2.5 text-[12px]" onClick={() => exportData("all", "json")}><DownloadIcon className="h-3.5 w-3.5" /> Everything JSON</button>}
                  </div>
                </div>

                <div className="px-4 pt-3">
                  <div className="mb-1 flex items-baseline justify-between text-[12px] text-fg-3">
                    <span>Heart rate{hist?.step_s ? " (average, band = min to max)" : ""} · alerts marked</span>
                    <span className="num">{hist ? `${hist.total_readings.toLocaleString()} readings in range` : ""}</span>
                  </div>
                  {hist && <Trend rows={hist.readings} alerts={hist.alerts} />}
                </div>

                <div className="scroll-thin mt-2 min-h-0 flex-1 overflow-y-auto px-4 pb-3">
                  <table className="num w-full text-[12.5px]">
                    <thead className="sticky top-0 bg-surface text-left text-[11.5px] text-fg-3">
                      <tr>
                        <th className="py-1.5 font-normal">Time (UTC)</th>
                        <th className="py-1.5 font-normal">Heart rate</th>
                        <th className="py-1.5 font-normal">SpO₂</th>
                        <th className="py-1.5 font-normal">Activity</th>
                        <th className="py-1.5 font-normal">{hist?.step_s ? "Samples" : "Signal"}</th>
                        <th className="py-1.5 font-normal">AEGIS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {hist?.readings.map((r) => {
                        const a = alertIn(r);
                        return (
                          <tr key={r.ts} className="odd:bg-white/[0.02]">
                            <td className="py-1 font-mono text-[11.5px] text-fg-2">{utc(r.ts)} <span className="text-fg-4">{utcDate(r.ts).split(" ").slice(0, 2).join(" ")}</span></td>
                            <td className="py-1" style={{ color: hrColor(r.heart_rate_max ?? r.heart_rate) }}>
                              {r.heart_rate.toFixed(0)} <span className="text-fg-4">bpm</span>
                              {r.heart_rate_min != null && <span className="ml-1 text-[11px] text-fg-4">{r.heart_rate_min.toFixed(0)}–{r.heart_rate_max!.toFixed(0)}</span>}
                            </td>
                            <td className="py-1" style={{ color: spo2Color(r.spo2_min ?? r.spo2) }}>{r.spo2 != null ? `${r.spo2.toFixed(0)} %` : "—"}</td>
                            <td className="py-1 text-fg-2">{r.activity}</td>
                            <td className="py-1 text-fg-3">{hist.step_s ? `${r.samples}${r.poor_signal ? ` · ${r.poor_signal} poor` : ""}` : r.signal_quality}</td>
                            <td className="py-1">
                              {a ? <span className="tag" style={{ color: SEVERITY[a.severity].color }} title={a.reason}>{SEVERITY[a.severity].label}</span> : <span className="text-fg-4">·</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {hist?.next_before && (
                    <button className="btn mt-2 w-full !h-8 text-[12.5px]" disabled={loading} onClick={() => load(hist.next_before)}>
                      {loading ? "Loading…" : `Load older (${hist.readings.length.toLocaleString()} shown)`}
                    </button>
                  )}
                  {hist && hist.checkins.length > 0 && (
                    <div className="mt-3 text-[12px] text-fg-3">
                      Check-ins in range: {hist.checkins.slice(0, 6).map((c) => `${feelingLabel(c.feeling)}${c.symptom ? ` (${c.symptom})` : ""} ${utc(c.ts)}`).join(" · ")}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="m-auto max-w-[360px] p-6 text-center text-[13px] text-fg-3">
                <div className="mb-2 text-[44px]">{flagOf(me.country_code)}</div>
                {me.name} has no wearable in this demo, so there is no measurement history. Select {crew.profile.name} to see every reading.
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
