"use client";
// When will Earth see this, and when can a reply arrive? From /api/spacecraft eta.
import { useLinkVisual } from "@/hooks/useLinkVisual";
import { useStore } from "@/lib/store";
import { StatusText } from "@/components/ui/Status";

export function EarthLinkStatus() {
  const sc = useStore((s) => s.spacecraft);
  const link = useLinkVisual();
  const queued = sc?.outbox.filter((b) => b.status === "queued" && !b.sent_at).length ?? 0;
  const n = (v?: number) => (v != null ? `~${Math.round(v)}` : "—");
  return (
    <div>
      <div className="num flex items-baseline gap-x-3 text-[11px] text-fg-3">
        <span className="whitespace-nowrap" title="When Earth will see a message sent now">Earth sees in <span className="text-[14px] font-semibold text-fg">{n(sc?.eta.earth_sees_in_min)}</span> min</span>
        <span className="whitespace-nowrap" title="Earliest possible reply from Earth">Reply in <span className="text-[14px] font-semibold text-fg">{n(sc?.eta.earliest_reply_in_min)}</span> min</span>
      </div>
      <div className="mt-0.5 text-[11px]">
        {link === "up" ? (
          <StatusText level="nominal" className="!font-normal">Link up · light-time delay only</StatusText>
        ) : link === "window" ? (
          <StatusText level="caution" className="!font-normal">Short contact window · priority layers first</StatusText>
        ) : (
          <StatusText level="warning" className="!font-normal">Link down · {queued} bundle{queued === 1 ? "" : "s"} held on board</StatusText>
        )}
      </div>
    </div>
  );
}
