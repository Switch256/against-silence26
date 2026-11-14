"use client";
import { useEffect, useState } from "react";
import { linkVisual, useStore, type LinkVisual } from "@/lib/store";

/** "up" | "down" | "window" — re-evaluated as the short-window flash expires. */
export function useLinkVisual(): LinkVisual {
  const spacecraft = useStore((s) => s.spacecraft);
  const windowUntil = useStore((s) => s.windowUntil);
  const [, force] = useState(0);
  const value = linkVisual({ spacecraft, windowUntil });
  useEffect(() => {
    if (value !== "window") return;
    const ms = Math.max(0, (windowUntil - performance.now() / 1000) * 1000) + 20;
    const id = window.setTimeout(() => force((n) => n + 1), ms);
    return () => window.clearTimeout(id);
  }, [value, windowUntil]);
  return value;
}
