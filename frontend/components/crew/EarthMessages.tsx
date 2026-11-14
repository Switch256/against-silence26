"use client";
// The latest reply from the Earth medical team that has arrived on board (highlighted when new).
import { utc } from "@/lib/format";
import { isFresh, isInFlight, useStore } from "@/lib/store";

export function EarthMessages() {
  const sc = useStore((s) => s.spacecraft);
  const flights = useStore((s) => s.flights);
  const fresh = useStore((s) => s.fresh);
  const replies = (sc?.replies ?? []).filter((r) => (r.status ?? "delivered") === "delivered" && !isInFlight(flights, r.reply_id));
  if (!replies.length) return <div className="text-[11px] text-fg-4">No messages from Earth yet.</div>;
  const r = replies[0];
  const isNew = isFresh(fresh, r.reply_id, 12000);
  return (
    <div key={r.reply_id} className={`enter rounded px-2.5 py-1.5 ${isNew ? "flash bg-raised ring-1 ring-accent/60" : "bg-raised"}`}>
      <div className="flex items-center justify-between text-[11px] text-fg-3">
        <span>{isNew ? <span className="font-semibold text-accent">New · </span> : null}{r.author}</span>
        <span className="num">{utc(r.delivered_at ?? r.created)} UTC{replies.length > 1 ? ` · ${replies.length - 1} earlier` : ""}</span>
      </div>
      <p className="mt-0.5 line-clamp-2 text-[12px] leading-[18px]" title={r.text}>{r.text}</p>
    </div>
  );
}
