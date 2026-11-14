"use client";
import { useEffect, useState } from "react";

/** Date.now(), refreshed every `ms` milliseconds. */
export function useNow(ms = 1000) {
  const [t, setT] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setT(Date.now()), ms);
    return () => window.clearInterval(id);
  }, [ms]);
  return t;
}
