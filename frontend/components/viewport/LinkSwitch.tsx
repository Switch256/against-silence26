"use client";
// The blackout switch, in plain sight for the judges: raise the astronaut's vitals, cut the space link,
// open a short contact window, or restore it. The same actions as the demo controller, one click (or the L key) away.
// Tagged "Demo" because a real crew cannot switch the link: on a mission it drops by itself.
import { useEffect, useState } from "react";
import { useLinkVisual } from "@/hooks/useLinkVisual";
import { useMission } from "@/hooks/useMission";

export function LinkSwitch() {
  const { actions, online } = useMission();
  const link = useLinkVisual();
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    try { await fn(); } finally { setBusy(false); }
  };
  const toggle = () => run(() => actions.setLink(link === "down" ? "up" : "down"));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if ((e.key === "l" || e.key === "L") && !e.metaKey && !e.ctrlKey && !e.altKey) toggle();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [link, busy]);

  const down = link === "down";
  return (
    <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-[rgba(11,13,14,0.82)] py-1 pr-1.5 pl-3 backdrop-blur-md">
      <span className="tag" title="A presenter control. On a real mission the link drops by itself.">Demo</span>
      <button
        className={`btn !h-7 !rounded-full ${down ? "btn-primary" : ""}`}
        disabled={!online || busy}
        onClick={toggle}
        aria-pressed={down}
        title={down ? "Restore the space link: held bundles go to Earth, headlines first (L)" : "Cut the space link: AEGIS keeps working, bundles are held on board (L)"}
      >
        {down ? "Restore link" : "Cut link"}
      </button>
      <button
        className="btn !h-7 !rounded-full"
        disabled={!online || busy}
        onClick={() => run(() => actions.sim("spike", 30, true))}
        title="Simulate a heart-rate rise at rest: AEGIS raises the alert on board and shows the crew what to do, with or without the link"
      >
        Raise vitals
      </button>
      <button
        className="btn btn-quiet !h-7 !rounded-full"
        disabled={!online || busy || link === "up"}
        onClick={() => run(() => actions.openWindow(250, 8))}
        title="Open an 8 s contact with a 250 byte budget: only the headlines fit"
      >
        Short window
      </button>
    </div>
  );
}
