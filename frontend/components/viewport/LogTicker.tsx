"use client";
// Live log along the bottom of the 3D view: one event at a time rises from the bottom, holds,
// then rises out as the next comes in. Newest first; it cycles through the recent events and
// jumps back to the newest whenever something new happens. Colour dot = the event's code.
// Pauses on hover; a click opens the full log drawer.
import { useEffect, useRef, useState } from "react";
import type { MissionEvent } from "@/lib/api";
import { COLORS } from "@/lib/constants";
import { utc } from "@/lib/format";
import { useStore } from "@/lib/store";

const HOLD_MS = 3200;
const RECENT = 12;

function colorOf(e: MissionEvent): string {
  const d = e.data ?? {};
  switch (e.kind) {
    case "alert": return d.severity === "urgent" ? COLORS.warning : d.severity === "review" ? COLORS.caution : COLORS.accent;
    case "checkin": return d.feeling === "unwell" ? COLORS.warning : d.feeling === "a_bit_off" ? COLORS.caution : COLORS.nominal;
    case "link_down": case "bundle_resend": case "reply_resend": return COLORS.warning;
    case "window": return COLORS.caution;
    case "link_up": case "reply_delivered": case "step_done": return COLORS.nominal;
    case "space_weather": return d.level === "warning" ? COLORS.warning : d.level === "caution" ? COLORS.caution : COLORS.accent;
    default: return COLORS.accent;
  }
}

export function LogTicker() {
  const events = useStore((s) => s.mission?.events ?? []);
  const openLog = useStore((s) => s.setLogOpen);
  const items = events.slice(0, RECENT);                 // newest first
  const newestKey = items[0] ? `${items[0].ts}|${items[0].text}` : "";
  const [i, setI] = useState(0);
  const [prev, setPrev] = useState<MissionEvent | null>(null);
  const hover = useRef(false);

  // something new happened: show it first
  useEffect(() => { setI((cur) => { if (items[cur]) setPrev(items[cur]); return 0; }); }, [newestKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const id = window.setInterval(() => {
      if (hover.current || items.length < 2) return;
      setI((cur) => { setPrev(items[cur] ?? null); return (cur + 1) % items.length; });
    }, HOLD_MS);
    return () => window.clearInterval(id);
  }, [items]);

  const e = items[i];
  if (!e) return null;
  const row = (ev: MissionEvent, cls: string) => (
    <span key={`${cls}-${ev.ts}-${ev.text}`} className={`${cls} absolute inset-0 flex items-center gap-2 px-4 whitespace-nowrap`}>
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: colorOf(ev) }} />
      <span className="num font-mono text-[11px] text-fg-4">{utc(ev.ts)}</span>
      <span className="truncate text-[12px] text-fg-2">{ev.text}</span>
    </span>
  );
  return (
    <button
      onClick={() => openLog(true)}
      onMouseEnter={() => (hover.current = true)}
      onMouseLeave={() => (hover.current = false)}
      className="relative block h-7 w-full overflow-hidden border-t border-line bg-[rgba(14,16,17,0.78)] text-left"
      title="Open the mission event log"
    >
      {prev && prev !== e && row(prev, "roll-out")}
      {row(e, "roll-in")}
      <span className="num absolute top-1/2 right-3 -translate-y-1/2 text-[10px] text-fg-4">{i + 1}/{items.length}</span>
    </button>
  );
}
