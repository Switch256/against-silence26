"use client";
// Page layout: status bar, then three columns (crew console | 3D view | Earth console).
// Either side panel can be hidden ([ and ] keys or the top-bar buttons); narrow screens start
// with both hidden. The event log and the demo controller are overlays, closed by default.
import { useEffect } from "react";
import { useStore } from "@/lib/store";
import { CrewConsole } from "@/components/crew/CrewConsole";
import { ScenarioController } from "@/components/demo/ScenarioController";
import { EarthConsole } from "@/components/earth/EarthConsole";
import { Viewport } from "@/components/viewport/Viewport";
import { LogDrawer } from "./LogDrawer";
import { TopBar } from "./TopBar";

const SIDE = "minmax(264px,300px)";

export function Console() {
  const panels = useStore((s) => s.panels);
  const setPanels = useStore((s) => s.setPanels);
  const togglePanel = useStore((s) => s.togglePanel);

  useEffect(() => {
    // remembered choice, else hide both on narrow screens so the 3D view stays usable
    let saved: { crew: boolean; earth: boolean } | null = null;
    try { saved = JSON.parse(localStorage.getItem("aegis.panels") ?? "null"); } catch { /* ignore */ }
    if (saved) setPanels(saved);
    else if (window.innerWidth < 1100) setPanels({ crew: false, earth: false });
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === "[") togglePanel("crew");
      else if (e.key === "]") togglePanel("earth");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setPanels, togglePanel]);

  const columns = [panels.crew && SIDE, "minmax(0,1fr)", panels.earth && SIDE].filter(Boolean).join(" ");
  return (
    <main className="flex h-dvh w-screen flex-col overflow-hidden bg-bg text-fg">
      <TopBar />
      <div className="grid min-h-0 flex-1 gap-2 p-2" style={{ gridTemplateColumns: columns }}>
        {panels.crew && <CrewConsole />}
        <Viewport />
        {panels.earth && <EarthConsole />}
      </div>
      <LogDrawer />
      <ScenarioController />
    </main>
  );
}
