"use client";
// Live feed: important new moments stay on screen, newest on top, each with its UTC time and a
// colour bar for its code (red warning, amber caution, green nominal, blue info). Older items
// shrink to one line; dismiss one, clear all, or collapse the feed (lib/notifications.ts).
import { useState } from "react";
import { utc } from "@/lib/format";
import { useStore, type ToastLevel } from "@/lib/store";
import { CloseIcon } from "@/components/ui/icons";
import { StatusMark, STATUS_COLOR, type StatusLevel } from "@/components/ui/Status";

const VISIBLE = 5;                              // the rest stay in the full log
const LEVEL: Record<ToastLevel, StatusLevel> = { info: "accent", nominal: "nominal", caution: "caution", warning: "warning" };

export function Toasts() {
  const toasts = useStore((s) => s.toasts);
  const dismiss = useStore((s) => s.dismissToast);
  const openLog = useStore((s) => s.setLogOpen);
  const openTarget = useStore((s) => s.openTarget);
  const [collapsed, setCollapsed] = useState(false);
  if (!toasts.length) return null;
  return (
    <div className="pointer-events-auto flex w-[320px] max-w-[calc(100vw-48px)] flex-col gap-1.5" aria-live="polite">
      <div className="flex items-center justify-between px-0.5 text-[11px] text-fg-3">
        <button className="flex items-center gap-1 hover:text-fg-2" onClick={() => setCollapsed(!collapsed)} aria-expanded={!collapsed}>
          <span className="h-1.5 w-1.5 rounded-full bg-accent" /> Live feed · {toasts.length}
        </button>
        <span className="flex gap-3">
          <button className="hover:text-fg-2" onClick={() => openLog(true)}>Full log</button>
          <button className="hover:text-fg-2" onClick={() => useStore.setState({ toasts: [] })}>Clear</button>
        </span>
      </div>
      {!collapsed && toasts.slice(0, VISIBLE).map((t, i) => {
        const lvl = LEVEL[t.level];
        const color = STATUS_COLOR[lvl];
        const compact = i >= 3;                       // older items shrink to one line
        return (
          <div
            key={t.id}
            className="rise flex gap-2 overflow-hidden rounded-lg border-[#3a4246] bg-[rgba(22,25,26,0.94)] py-2 pr-2.5 pl-0 shadow-[0_6px_20px_rgba(0,0,0,0.35)]"
            style={{ opacity: compact ? 0.8 : 1 }}
          >
            <span className="w-[3px] shrink-0 rounded-r" style={{ background: color }} aria-hidden />
            <span className="mt-0.5 shrink-0" style={{ color }}><StatusMark level={lvl} /></span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-[12px] leading-5 font-semibold" style={{ color: t.level === "info" ? undefined : color }}>{t.title}</span>
                <span className="num shrink-0 text-[11px] text-fg-3">{utc(t.ts)}</span>
              </div>
              {!compact && t.detail && <div className="line-clamp-2 text-[12px] leading-[17px] text-fg-2">{t.detail}</div>}
              {!compact && t.target && (
                <button
                  onClick={() => openTarget(t.target!)}
                  className="mt-0.5 text-[11px] font-medium text-accent hover:underline"
                >
                  View on the {t.target.panel === "earth" ? "Earth" : "spacecraft"} console →
                </button>
              )}
            </div>
            <button onClick={() => dismiss(t.id)} className="self-start text-fg-4 hover:text-fg-2" aria-label="Dismiss"><CloseIcon className="h-3.5 w-3.5" /></button>
          </div>
        );
      })}
    </div>
  );
}
