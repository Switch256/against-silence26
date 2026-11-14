"use client";
// BPv7 node counters as reported by dtn7-rs on each side of the link.
import type { NodeCounters as Counters } from "@/lib/api";
import { useStore } from "@/lib/store";

const COLS: (keyof Counters)[] = ["outgoing", "incoming", "delivered", "failed"];

export function NodeCounters() {
  const bp = useStore((s) => s.mission?.bpv7);
  const transport = useStore((s) => s.stats?.transport);
  if (!bp) {
    return <div className="w-[230px] text-[12px] text-fg-4">{transport === "dtn" ? "BPv7 counters unavailable" : "Local transport · no BPv7 nodes"}</div>;
  }
  const rows: [string, Counters | null | undefined][] = [["Spacecraft", bp.spacecraft], ["Earth", bp.earth]];
  return (
    <table className="num w-[260px] text-[11px]">
      <thead>
        <tr className="text-fg-3">
          <th className="pb-0.5 text-left font-medium">BPv7 node</th>
          {COLS.map((c) => <th key={c} className="pb-0.5 text-right font-medium capitalize">{c === "outgoing" ? "Out" : c === "incoming" ? "In" : c}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map(([name, c]) => (
          <tr key={name} className="border-t border-line">
            <td className="py-0.5 text-fg-2">{name}</td>
            {COLS.map((k) => <td key={k} className="py-0.5 text-right text-fg">{c ? c[k] ?? 0 : "—"}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
