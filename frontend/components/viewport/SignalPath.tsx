"use client";
// Signal path: the whole story in one strip. Spacecraft on the left, Earth on the right, the space
// link between them. Held bundles queue at the spacecraft; crossing bundles travel along the line
// (timed from real BPv7 hand-off / arrival); replies travel back. Link up = blue with flowing pulses,
// down = broken red, short window = amber.
import { useEffect, useState } from "react";
import { useLinkVisual } from "@/hooks/useLinkVisual";
import { COLORS } from "@/lib/constants";
import { now, servingStation, useStore } from "@/lib/store";
import { DSN_STATIONS } from "@/lib/constants";

const LAYER_COLOR: Record<string, string> = { headline: COLORS.warning, context: COLORS.caution, evidence: COLORS.accent };

export function SignalPath() {
  const link = useLinkVisual();
  const flights = useStore((s) => s.flights);
  const held = useStore((s) => s.outbox);
  const mission = useStore((s) => s.mission);
  const sc = useStore((s) => s.spacecraft);
  const [t, setT] = useState(now());
  useEffect(() => {
    let raf = 0;
    const tick = () => { setT(now()); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const station = DSN_STATIONS.find((s) => s.id === servingStation(mission));
  const delayMin = (mission?.spacecraft?.light_delay_s ?? (sc?.eta.one_way_delay_min ?? 14) * 60) / 60;
  const lineColor = link === "up" ? COLORS.accent : link === "window" ? COLORS.caution : COLORS.warning;
  const moving = flights
    .map((f) => ({ f, p: (t - f.start) / f.duration }))
    .filter(({ p }) => p >= 0 && p <= 1);
  const stateText = link === "up" ? "Link up" : link === "window" ? "Short contact window · headlines first" : "Link down · loss of signal";

  return (
    <div className="pointer-events-none w-[min(620px,calc(100%-120px))] rounded-2xl bg-[rgba(11,13,14,0.82)] px-4 py-2.5 backdrop-blur-md">
      <div className="flex items-center gap-3">
        {/* spacecraft + held queue */}
        <div className="flex shrink-0 items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-fg" />
          <div className="leading-tight">
            <div className="text-[12px] font-semibold">AEGIS-1</div>
            <div className="text-[10.5px] text-fg-3">{held.length ? `${held.length} held on board` : "spacecraft"}</div>
          </div>
          {held.length > 0 && (
            <div className="flex -space-x-0.5">
              {held.slice(0, 6).map((h) => <span key={h.id} className="h-2 w-2 rounded-full ring-2 ring-[#0b0d0e]" style={{ background: LAYER_COLOR[h.layer] }} />)}
            </div>
          )}
        </div>

        {/* the link */}
        <div className="relative h-7 min-w-0 flex-1">
          <svg className="absolute inset-0 h-full w-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 28">
            {link === "down" ? (
              <>
                <line x1="0" y1="14" x2="40" y2="14" stroke={lineColor} strokeWidth="1.5" vectorEffect="non-scaling-stroke" opacity="0.55" />
                <line x1="60" y1="14" x2="100" y2="14" stroke={lineColor} strokeWidth="1.5" vectorEffect="non-scaling-stroke" opacity="0.55" />
              </>
            ) : (
              <line x1="0" y1="14" x2="100" y2="14" stroke={lineColor} strokeWidth="1.5" vectorEffect="non-scaling-stroke"
                strokeDasharray={link === "up" ? "6 5" : undefined} className={link === "up" ? "signal-flow" : "signal-blink"} />
            )}
          </svg>
          {link === "down" && <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[13px] font-bold" style={{ color: lineColor }}>✕</span>}
          {moving.map(({ f, p }) => {
            const x = f.kind === "reply" ? 1 - p : p;
            const color = f.kind === "reply" ? COLORS.nominal : LAYER_COLOR[f.layer ?? "headline"];
            return (
              <span key={f.id} className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{ left: `${x * 100}%`, background: color, boxShadow: `0 0 10px ${color}` }} />
            );
          })}
          <span className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 text-[10.5px] whitespace-nowrap" style={{ color: link === "up" ? COLORS.fg3 : lineColor }}>
            {stateText} · {delayMin.toFixed(0)} min light time
          </span>
        </div>

        {/* earth */}
        <div className="flex shrink-0 items-center gap-2 text-right">
          <div className="leading-tight">
            <div className="text-[12px] font-semibold">Earth</div>
            <div className="text-[10.5px] text-fg-3">DSN {station?.name ?? ""}</div>
          </div>
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#4f8fd8", boxShadow: "0 0 8px rgba(79,143,216,0.7)" }} />
        </div>
      </div>
    </div>
  );
}
