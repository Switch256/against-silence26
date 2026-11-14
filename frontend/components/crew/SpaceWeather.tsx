"use client";
// Space environment from NASA DONKI (real data). One line at a glance; events, guidance and the
// "not a dose" note expand in place. The May 2024 replay is clearly badged.
import { useState } from "react";
import type { SpaceWeatherLevel } from "@/lib/api";
import { utcDate } from "@/lib/format";
import { useStore } from "@/lib/store";
import { ChevronIcon, ExternalIcon } from "@/components/ui/icons";
import { StatusText, type StatusLevel } from "@/components/ui/Status";

export function spaceWeatherStatus(level?: SpaceWeatherLevel): StatusLevel {
  return level === "warning" ? "warning" : level === "caution" ? "caution" : level === "nominal" ? "nominal" : "neutral";
}
export const spaceWeatherWord = (level?: SpaceWeatherLevel) =>
  !level ? "—" : level === "info" ? "Advisory" : level.charAt(0).toUpperCase() + level.slice(1);

const KIND: Record<string, string> = { SEP: "Solar particle event", CME: "Coronal mass ejection", GST: "Geomagnetic storm", RBE: "Radiation belt enhancement" };

export function SpaceWeather() {
  const sw = useStore((s) => s.spaceWeather);
  const [open, setOpen] = useState(false);
  if (!sw) return <div className="text-[12px] text-fg-4">Waiting for NASA DONKI…</div>;
  const events = (sw.active.length ? sw.active : sw.recent).slice(0, 4);
  return (
    <div>
      <button className="flex w-full items-start gap-2 text-left" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="shrink-0 text-[12px] leading-5"><StatusText level={spaceWeatherStatus(sw.level)}>{spaceWeatherWord(sw.level)}</StatusText></span>
        {sw.mode === "replay" && <span className="mt-0.5 shrink-0 rounded-[3px] border border-accent/60 px-1 text-[10px] leading-4 text-accent" title="Replay of the real May 2024 solar particle event">REPLAY</span>}
        <span className={`min-w-0 flex-1 text-[12px] leading-5 text-fg-2 ${open ? "" : "truncate"}`}>{sw.headline}</span>
        <ChevronIcon className={`mt-0.5 h-4 w-4 shrink-0 text-fg-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && sw.mode === "replay" && <div className="mt-1 text-[11px] text-accent">Replay of the real May 2024 solar particle event</div>}
      {open && (
        <div className="enter mt-2 space-y-2">
          {sw.todo.length > 0 && (
            <ul className="list-disc space-y-0.5 pl-5 text-[13px]">{sw.todo.map((t) => <li key={t}>{t}</li>)}</ul>
          )}
          <ul className="space-y-1">
            {events.map((e) => (
              <li key={e.event_id} className="flex items-center gap-2 text-[12px]">
                <span className="w-8 shrink-0 font-mono text-[11px] text-fg-3" title={KIND[e.kind] ?? e.kind}>{e.kind}</span>
                <span className="min-w-0 flex-1 truncate text-fg-2" title={e.summary}>{e.summary}</span>
                <span className="num shrink-0 text-[11px] text-fg-4">{utcDate(e.start_time)}</span>
                {e.link && (
                  <a href={e.link} target="_blank" rel="noreferrer" className="shrink-0 text-fg-3 hover:text-accent" title="Open the event in NASA DONKI">
                    <ExternalIcon className="h-3.5 w-3.5" />
                  </a>
                )}
              </li>
            ))}
          </ul>
          <div className="text-[11px] text-fg-4">{sw.note ?? "Environmental conditions, not a measured crew dose."}{sw.as_of ? ` As of ${utcDate(sw.as_of)} UTC.` : ""}</div>
        </div>
      )}
    </div>
  );
}
