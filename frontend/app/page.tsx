"use client";
import dynamic from "next/dynamic";
import { useEffect } from "react";
import { useMissionPolling } from "@/hooks/useMission";
import { useStore, type CameraView } from "@/lib/store";

// three.js needs the browser: load the scene on the client only.
const Scene = dynamic(() => import("@/components/scene/Scene"), { ssr: false });
// The HUD shows live clocks and telemetry, so it is client-rendered too (no hydration mismatch).
const Hud = dynamic(() => import("@/components/hud/Hud").then((m) => m.Hud), { ssr: false });

export default function Page() {
  useMissionPolling();
  // ?view=spacecraft|earth|overview picks the opening camera (handy for presenting).
  useEffect(() => {
    const v = new URLSearchParams(window.location.search).get("view");
    if (v === "spacecraft" || v === "earth" || v === "overview") useStore.getState().setView(v as CameraView);
  }, []);
  return (
    <main className="relative h-dvh w-screen overflow-hidden bg-space">
      <Scene />
      <Hud />
    </main>
  );
}
