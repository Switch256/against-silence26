"use client";
// Earth medical console: incoming PulseBriefs, newest first. The selected one is expanded.
import { useEffect, useState } from "react";
import { DSN_STATIONS } from "@/lib/constants";
import { servingStation, useStore } from "@/lib/store";
import { Panel } from "@/components/ui/Panel";
import { BriefCard } from "./BriefCard";

export function EarthConsole() {
  const earth = useStore((s) => s.earth);
  const sc = useStore((s) => s.spacecraft);
  const mission = useStore((s) => s.mission);
  const [openId, setOpenId] = useState<string | null>(null);
  const focus = useStore((s) => s.focusBrief);
  useEffect(() => { if (focus) setOpenId(focus.id); }, [focus]);
  const station = DSN_STATIONS.find((s) => s.id === servingStation(mission))!;
  const briefs = earth?.briefs ?? [];
  const current = openId ?? briefs[0]?.brief_id ?? null;

  return (
    <Panel
      title="Earth console"
      meta={`DSN ${station.name}`}
      right={<span className="num text-[12px] text-fg-3">{briefs.length} brief{briefs.length === 1 ? "" : "s"}</span>}
      className="h-full"
      bodyClassName="scroll-thin space-y-1.5 overflow-y-auto p-3"
    >
      {briefs.length === 0 ? (
        <div className="px-2 py-8 text-center">
          <div className="text-[13px] text-fg-2">No PulseBriefs received</div>
          <div className="mx-auto mt-1 max-w-[260px] text-[12px] text-fg-4">
            AEGIS sends each alert in three layers: headline first, then context, then evidence.
          </div>
        </div>
      ) : (
        briefs.map((b) => (
          <BriefCard
            key={b.brief_id}
            brief={b}
            bundles={(sc?.outbox ?? []).filter((x) => x.brief_id === b.brief_id)}
            replies={(earth?.replies ?? []).filter((r) => r.brief_id === b.brief_id)}
            open={current === b.brief_id}
            onToggle={() => setOpenId(current === b.brief_id ? "__none__" : b.brief_id)}
          />
        ))
      )}
    </Panel>
  );
}
