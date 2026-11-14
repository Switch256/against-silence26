"use client";
// Secondary vitals as one quiet line: blood oxygen, activity, signal quality.
// Status colour and mark appear only when a value is off-nominal.
import type { Reading } from "@/lib/api";
import { StatusMark, STATUS_COLOR, type StatusLevel } from "@/components/ui/Status";

function Item({ label, value, level }: { label: string; value: string; level?: StatusLevel }) {
  const off = level === "caution" || level === "warning";
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="text-[11px] text-fg-3">{label}</span>
      <span className="num flex items-center gap-1 text-[13px] font-medium capitalize" style={off ? { color: STATUS_COLOR[level!] } : undefined}>
        {off && <StatusMark level={level!} className="h-3.5 w-3.5 self-center" />}
        {value}
      </span>
    </span>
  );
}

export function VitalsLine({ last }: { last?: Reading }) {
  const spo2 = last?.spo2 ?? null;
  const spo2Level: StatusLevel = spo2 == null ? "neutral" : spo2 < 90 ? "warning" : spo2 < 94 ? "caution" : "nominal";
  const sq = last?.signal_quality ?? "—";
  return (
    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-0.5">
      <Item label="SpO₂" value={spo2 != null ? `${spo2.toFixed(0)} %` : "—"} level={spo2Level} />
      <Item label="Activity" value={last?.activity?.replace(/_/g, " ") ?? "—"} />
      <Item label="Signal" value={sq} level={sq === "poor" ? "caution" : "nominal"} />
    </div>
  );
}
