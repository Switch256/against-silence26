"use client";
// Crew body: the live 3D figure (BodyFigure) with the key numbers beside it. All physiology shown on
// the figure is driven by the simulated telemetry stream; breathing rate is an estimate, not measured.
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { flagOf, useCrew } from "@/hooks/useCrew";
import { useStore } from "@/lib/store";
import type { Reading, Severity } from "@/lib/api";
import { COLORS } from "@/lib/constants";
import { ProvenanceTag, provenanceOf, STATUS_COLOR, type StatusLevel } from "@/components/ui/Status";
import { BodyFigure, type BodyLive } from "./BodyFigure";
import { levelOf, median } from "./HeartRate";

/** Estimated breathing rate (simulated): follows heart rate and activity, rises when oxygen is low. */
export function estimateBreathing(hr: number | null, activity: string, spo2: number | null) {
  if (hr == null) return 14;
  let r = activity === "exercise" ? 19 + (hr - 100) * 0.13 : 12.5 + (hr - 68) * 0.11;
  if (spo2 != null && spo2 < 95) r += (95 - spo2) * 0.7;
  return Math.max(9, Math.min(36, r));
}

function useReducedMotion() {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}

/** Ease a displayed number towards its target so values glide between readings. */
function useSmooth(target: number | null, ms = 700) {
  const [v, setV] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    if (target == null) { setV(null); from.current = null; return; }
    const a = from.current ?? target;
    const t0 = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const k = Math.max(0, Math.min(1, (now - t0) / ms));   // rAF time can precede t0
      const x = a + (target - a) * (1 - (1 - k) ** 3);
      from.current = x;
      setV(x);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

const rank = (l: StatusLevel) => (l === "warning" ? 2 : l === "caution" ? 1 : 0);
const sevLevel = (s?: Severity | null): StatusLevel => (s === "urgent" ? "warning" : s === "review" ? "caution" : "neutral");

interface Props {
  readings: Reading[];
  alertBaseline: number | null;
  /** severity of a recent crew alert (not space weather), if any */
  alertSeverity: Severity | null;
  /** the recent alert is about heart rate */
  alertOnHeart: boolean;
  astronautId: string;
}

export function CrewBody({ readings, alertBaseline, alertSeverity, alertOnHeart, astronautId }: Props) {
  const crew = useCrew();
  const setCrewOpen = useStore((s) => s.setCrewOpen);
  const last = readings.at(-1);
  const hr = last?.heart_rate ?? null;
  const spo2 = last?.spo2 ?? null;
  const activity = last?.activity ?? "rest";
  const poor = last?.signal_quality === "poor";
  const baseline = alertBaseline ?? median(readings.filter((r) => r.activity === "rest").slice(0, 60).map((r) => r.heart_rate));
  const hrLevel = levelOf(hr ?? undefined, baseline, activity);
  const alertLevel = sevLevel(alertSeverity);
  const heartLevel: StatusLevel = rank(alertOnHeart ? alertLevel : "neutral") > rank(hrLevel) ? alertLevel : hrLevel;
  const spo2Level: StatusLevel = spo2 == null ? "neutral" : spo2 < 90 ? "warning" : spo2 < 94 ? "caution" : "neutral";
  const bodyAlert: StatusLevel = [alertLevel, hrLevel, spo2Level].reduce((a, b) => (rank(b) > rank(a) ? b : a), "neutral" as StatusLevel);
  const hypoxia = spo2 == null ? 0 : Math.max(0, Math.min(1, (95.5 - spo2) / 7));
  const breath = estimateBreathing(hr, activity, spo2);
  const reducedMotion = useReducedMotion();

  const live = useRef<BodyLive>({
    hr, breath, activity, hypoxia, heart: "nominal", alert: "none", poorSignal: poor, readingKey: "", reducedMotion,
  });
  live.current = {
    hr, breath, activity, hypoxia, poorSignal: poor, reducedMotion,
    heart: heartLevel === "warning" ? "warning" : heartLevel === "caution" ? "caution" : "nominal",
    alert: bodyAlert === "warning" ? "warning" : bodyAlert === "caution" ? "caution" : "none",
    readingKey: last?.ts ?? "",
  };

  const hrShown = useSmooth(hr);
  const spo2Shown = useSmooth(spo2);
  const breathShown = useSmooth(hr == null ? null : breath, 1500);

  const offColor = (l: StatusLevel) => (rank(l) > 0 ? STATUS_COLOR[l] : undefined);
  const halo = bodyAlert === "warning" ? COLORS.warning : bodyAlert === "caution" ? COLORS.caution : hypoxia > 0.2 ? "#4d78ff" : "#5d7392";
  const haloOpacity = rank(bodyAlert) > 0 ? 0.22 : hypoxia > 0.2 ? 0.2 : 0.12;

  // one plain sentence about the body right now, most important first
  const status: { text: string; level: StatusLevel } = poor
    ? { text: "Sensor contact poor, values may be off", level: "caution" }
    : spo2Level !== "neutral"
      ? { text: "Blood oxygen low", level: spo2Level }
      : rank(hrLevel) > 0
        ? { text: activity === "exercise" ? "Heart rate high" : "Heart rate high for rest", level: hrLevel }
        : rank(alertLevel) > 0
          ? { text: "Alert active, see below", level: alertLevel }
          : activity === "exercise"
          ? { text: "Exercising, body responding normally", level: "nominal" }
          : hr == null ? { text: "Waiting for telemetry", level: "neutral" } : { text: "At rest, steady", level: "nominal" };

  return (
    <div className="mx-3 mt-1 flex h-[172px] overflow-hidden rounded-xl bg-sunken">
      <div className="relative w-[112px] shrink-0">
        <div
          className="absolute top-[22%] left-1/2 h-[96px] w-[96px] -translate-x-1/2 rounded-full blur-[30px]"
          style={{ background: halo, opacity: haloOpacity, transition: "background-color 1.2s, opacity 1.2s" }}
        />
        <div className="absolute inset-0 [mask-image:linear-gradient(to_bottom,black_78%,transparent)]">
          <BodyFigure live={live} />
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col py-3 pr-3.5 pl-1">
        <div className="min-w-0 leading-tight">
          <button className="flex max-w-full items-center gap-1.5 text-left hover:text-accent" onClick={() => setCrewOpen(true)} title="Open the crew record: profile, every measurement, export">
            <span className="text-[15px] leading-none" aria-label={crew?.profile.nationality}>{flagOf(crew?.profile.country_code)}</span>
            <span className="truncate text-[13px] font-semibold">{crew?.profile.name ?? "Crew member 1"}</span>
          </button>
          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-fg-3">
            <span className="truncate">{crew?.profile.age ? `${crew.profile.age} · ${crew.profile.role}` : astronautId}</span>
            <ProvenanceTag value={provenanceOf(last?.source)} title="The body view is driven by simulated telemetry" />
          </div>
        </div>

        <dl className="mt-auto grid grid-cols-[auto_1fr] items-baseline gap-x-2 gap-y-1">
          <dt className="flex items-center gap-1.5 text-[11px] text-fg-3">
            <span
              className="beat-dot inline-block h-1.5 w-1.5 rounded-full"
              style={{ background: STATUS_COLOR[heartLevel === "neutral" ? "nominal" : heartLevel], animationDuration: hr ? `${(60 / hr).toFixed(3)}s` : undefined, opacity: hr ? 1 : 0.3 }}
            />
            Heart
          </dt>
          <dd className="num flex items-baseline justify-end gap-1">
            <span className="text-[18px] leading-none font-semibold" style={{ color: offColor(hrLevel) }}>
              {hrShown != null ? Math.round(hrShown) : "––"}
            </span>
            <span className="w-6 text-[11px] text-fg-3">bpm</span>
          </dd>
          <dt className="text-[11px] text-fg-3">SpO₂</dt>
          <dd className="num flex items-baseline justify-end gap-1">
            <span className="text-[15px] leading-none font-medium" style={{ color: offColor(spo2Level) }}>
              {spo2Shown != null ? Math.round(spo2Shown) : "––"}
            </span>
            <span className="w-6 text-[11px] text-fg-3">%</span>
          </dd>
          <dt className="whitespace-nowrap text-[11px] text-fg-3" title="Estimated from heart rate, activity and oxygen (simulated)">Breathing <span className="text-[10px] text-fg-4">est.</span></dt>
          <dd className="num flex items-baseline justify-end gap-1">
            <span className="text-[15px] leading-none font-medium text-fg-2">{breathShown != null ? Math.round(breathShown) : "––"}</span>
            <span className="w-6 text-[11px] text-fg-3">/min</span>
          </dd>
        </dl>

        <div className="mt-2 flex items-center gap-1.5 text-[11px] leading-tight" style={{ color: rank(status.level) > 0 ? STATUS_COLOR[status.level] : COLORS.fg3 }}>
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${poor ? "signal-blink" : ""}`} style={{ background: STATUS_COLOR[status.level] }} />
          <span className="min-w-0">{status.text}</span>
        </div>
      </div>
    </div>
  );
}
