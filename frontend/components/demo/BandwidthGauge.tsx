"use client";
// Bytes actually sent over the space link vs. sending every raw reading.
import { fmtBytes } from "@/lib/format";
import { useStore } from "@/lib/store";

export function BandwidthGauge() {
  const stats = useStore((s) => s.stats);
  const sent = stats?.bytes_sent ?? 0;
  const raw = stats?.raw_bytes_equivalent ?? 0;
  const frac = raw > 0 ? Math.min(1, sent / raw) : 0;
  return (
    <div className="w-[240px]">
      <div className="flex items-baseline justify-between">
        <span className="text-[12px] text-fg-3">Link bytes vs raw readings</span>
        <span className="num text-[13px] font-semibold">{raw ? `${Math.round((1 - frac) * 100)}% saved` : "—"}</span>
      </div>
      <div className="mt-1.5 space-y-1">
        {[
          { k: "Sent over link", v: sent, w: raw ? Math.max(frac * 100, sent ? 1 : 0) : 0, c: "bg-accent" },
          { k: "All raw readings", v: raw, w: raw ? 100 : 0, c: "bg-line-strong" },
        ].map((r) => (
          <div key={r.k} className="grid grid-cols-[96px_1fr_56px] items-center gap-2 text-[11px]">
            <span className="text-fg-3">{r.k}</span>
            <span className="h-1.5 overflow-hidden rounded-sm bg-raised"><span className={`block h-full ${r.c} transition-[width] duration-700`} style={{ width: `${r.w}%` }} /></span>
            <span className="num text-right text-fg-2">{fmtBytes(r.v)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
