"use client";
import dynamic from "next/dynamic";
import { useEffect } from "react";
import { useMissionPolling } from "@/hooks/useMission";
import { useStore, type CameraView } from "@/lib/store";

// The live mission console. Everything shows live clocks, telemetry or WebGL, so it renders on the client only.
const Console = dynamic(() => import("@/components/layout/Console").then((m) => m.Console), { ssr: false });

export default function DemoPage() {
  useMissionPolling();
  // ?view=spacecraft|earth|overview picks the opening shot; the auto camera takes over from there.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const v = q.get("view");
    if (q.get("crew") === "1") useStore.getState().setCrewOpen(true);     // ?crew=1 opens the crew record
    if (v === "spacecraft" || v === "earth" || v === "overview") useStore.getState().autoSetView(v as CameraView);
  }, []);
  return <Console />;
}
