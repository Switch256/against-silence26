"use client";
import dynamic from "next/dynamic";
import { useEffect } from "react";
import { useMissionPolling } from "@/hooks/useMission";
import { useStore, type CameraView } from "@/lib/store";

// Everything shows live clocks, telemetry or WebGL, so it renders on the client only.
const Console = dynamic(() => import("@/components/layout/Console").then((m) => m.Console), { ssr: false });

export default function Page() {
  useMissionPolling();
  // ?view=spacecraft|earth|overview picks the opening camera (handy for presenting).
  useEffect(() => {
    const v = new URLSearchParams(window.location.search).get("view");
    if (v === "spacecraft" || v === "earth" || v === "overview") useStore.getState().setView(v as CameraView);
  }, []);
  return <Console />;
}
