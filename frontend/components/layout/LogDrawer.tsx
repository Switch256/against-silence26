"use client";
// Full mission event log, opened from the bell, a toast or the ticker.
import { useEffect } from "react";
import { utc } from "@/lib/format";
import { useStore } from "@/lib/store";
import { CloseIcon } from "@/components/ui/icons";

function label(kind: string) {
  const k = kind.toLowerCase();
  if (k.includes("deliver") || k.includes("arriv")) return "Received";
  if (k.includes("sent") || k.includes("send")) return "Sent";
  if (k.includes("space") || k.includes("donki")) return "Space weather";
  if (k.includes("check")) return "Check-in";
  if (k.includes("window")) return "Window";
  if (k.includes("link")) return "Link";
  if (k.includes("reply")) return "Reply";
  if (k.includes("alert")) return "Alert";
  if (k.includes("brief")) return "Brief";
  return k.replace(/_/g, " ");
}

export function LogDrawer() {
  const open = useStore((s) => s.logOpen);
  const setOpen = useStore((s) => s.setLogOpen);
  const events = useStore((s) => s.mission?.events ?? []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40" onClick={() => setOpen(false)}>
      <aside
        className="enter absolute top-[52px] right-0 bottom-0 flex w-[440px] flex-col bg-surface shadow-[-12px_0_32px_rgba(0,0,0,0.45)]"
        onClick={(e) => e.stopPropagation()}
        aria-label="Mission event log"
      >
        <header className="panel-header">
          <div className="flex items-baseline gap-2">
            <h2 className="panel-title">Mission event log</h2>
            <span className="text-[12px] text-fg-3">UTC · newest first</span>
          </div>
          <button className="btn btn-quiet !px-2" onClick={() => setOpen(false)} aria-label="Close"><CloseIcon className="h-4 w-4" /></button>
        </header>
        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-4 py-2">
          {events.length === 0 ? (
            <div className="py-4 text-[13px] text-fg-4">No events yet.</div>
          ) : (
            <table className="num w-full text-[12px]">
              <tbody>
                {events.map((e, i) => (
                  <tr key={`${e.ts}-${i}`} className="odd:bg-white/[0.02]">
                    <td className="w-[70px] py-1.5 align-top font-mono text-[11px] text-fg-3">{utc(e.ts)}</td>
                    <td className="w-[100px] py-1.5 align-top text-fg-3">{label(e.kind)}</td>
                    <td className="py-1.5 text-fg-2">{e.text}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </aside>
    </div>
  );
}
