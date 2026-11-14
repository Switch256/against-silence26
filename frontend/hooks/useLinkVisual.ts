"use client";
import { linkVisual, useStore, type LinkVisual } from "@/lib/store";

/** "up" | "down" | "window", straight from the backend's link.state. */
export function useLinkVisual(): LinkVisual {
  return linkVisual(useStore((s) => s.spacecraft));
}
