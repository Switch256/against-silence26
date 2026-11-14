"use client";
// Crew on board, beside the HUD readouts: portrait + flag, first name and heart rate.
// crew-01 is the live (simulated) telemetry stream; the others have no wearable in the backend,
// so their resting heart rate here is a browser-side simulation, labelled "sim" and never stored.
import { useEffect, useState } from "react";
import { CrewAvatar } from "@/components/crew/CrewAvatar";
import { levelOf, median } from "@/components/crew/HeartRate";
import { STATUS_COLOR } from "@/components/ui/Status";
import { useCrew } from "@/hooks/useCrew";
import { useStore } from "@/lib/store";

const SIM_REST: Record<string, number> = { "crew-02": 61, "crew-03": 67 };

function simHr(id: string, t: number) {
  const base = SIM_REST[id] ?? 68;
  const k = id.charCodeAt(id.length - 1);
  return base + 2.4 * Math.sin(t / 7 + k) + 1.3 * Math.sin(t / 2.3 + k * 1.7) + 0.8 * Math.sin(t * 1.9 + k);
}

export function CrewStrip() {
  const crew = useCrew();
  const readings = useStore((s) => s.spacecraft?.readings);
  const setCrewOpen = useStore((s) => s.setCrewOpen);
  const [t, setT] = useState(() => Date.now() / 1000);
  useEffect(() => {
    const id = setInterval(() => setT(Date.now() / 1000), 1000);
    return () => clearInterval(id);
  }, []);
  if (!crew) return null;
  const last = readings?.at(-1);
  const baseline = median((readings ?? []).filter((r) => r.activity === "rest").slice(-60).map((r) => r.heart_rate));

  return (
    <div className="pointer-events-auto flex shrink-0 items-center gap-3.5" role="list" aria-label="Crew on board">
      {crew.crew.map((c) => {
        const live = c.monitored;
        const hr = live ? last?.heart_rate : simHr(c.astronaut_id, t);
        const level = live ? levelOf(hr, baseline, last?.activity) : "neutral";
        const color = level === "neutral" ? undefined : STATUS_COLOR[level];
        return (
          <button
            key={c.astronaut_id}
            role="listitem"
            className="flex items-center gap-2 text-left"
            onClick={() => setCrewOpen(true)}
            title={`${c.name} · ${c.nationality} · ${c.role}${live ? " · live (simulated) telemetry" : " · simulated resting heart rate, no wearable in the demo"}`}
          >
            <CrewAvatar id={c.astronaut_id} size={32} countryCode={c.country_code} ring={color} />
            <span className="leading-none">
              <span className="hidden text-[12px] text-fg-2 @[900px]:block">{c.name.split(" ")[0]}</span>
              <span className="num flex items-baseline gap-1 @[900px]:mt-1">
                <span className="text-[17px] font-light" style={color ? { color } : undefined}>{hr != null ? Math.round(hr) : "—"}</span>
                <span className="text-[10.5px] text-fg-4">bpm{live ? "" : " · sim"}</span>
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
