"use client";
// The (fictional) crew roster + the monitored astronaut's baselines, fetched once and shared.
// Falls back to the built-in copy when the backend is unreachable (e.g. GitHub Pages).
import { useEffect, useState } from "react";
import { api, type CrewSummary } from "@/lib/api";
import { demoCrew } from "@/lib/demo";

let cache: CrewSummary | null = null;
let inflight: Promise<CrewSummary> | null = null;

export function loadCrew(force = false): Promise<CrewSummary> {
  if (cache && !force) return Promise.resolve(cache);
  inflight ??= api.crew().catch(() => demoCrew).then((c) => {
    cache = c;
    inflight = null;
    return c;
  });
  return inflight;
}

export function useCrew(refreshKey?: unknown) {
  const [crew, setCrew] = useState<CrewSummary | null>(cache);
  useEffect(() => {
    let alive = true;
    loadCrew(refreshKey !== undefined).then((c) => alive && setCrew(c));
    return () => { alive = false; };
  }, [refreshKey]);
  return crew;
}

/** Regional-indicator emoji flag from an ISO 3166-1 alpha-2 code ("TR" -> 🇹🇷). */
export function flagOf(code?: string) {
  if (!code || code.length !== 2) return "";
  return String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}
