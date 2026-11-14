"use client";
// Lifecycle of one PulseBrief as a minimal three-step timeline (headline -> context -> evidence),
// timed from the backend's sent_at / delivered_at, plus the reply on the way back.
import type { Bundle, Reply } from "@/lib/api";
import { COLORS, LAYER_LABEL, LAYER_ORDER } from "@/lib/constants";
import { fmtSpan, utc, utcTenths } from "@/lib/format";
import { isInFlight, useStore } from "@/lib/store";

type StepState = "received" | "transit" | "onboard";

/** "received" only once the marker has landed on screen, so the timeline never runs ahead of the view. */
function stateOf(b: Bundle | Reply | undefined, flying: boolean): StepState {
  if (b?.delivered_at && !flying) return "received";
  if (b?.sent_at) return "transit";
  return "onboard";
}

function Dot({ state }: { state: StepState }) {
  if (state === "received") return <span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS.nominal }} />;
  if (state === "transit") return <span className="h-2.5 w-2.5 rounded-full border-2" style={{ borderColor: COLORS.accent }} />;
  return <span className="h-2.5 w-2.5 rounded-full border" style={{ borderColor: COLORS.fg4 }} />;
}

export function BriefTimeline({ bundles, replies }: { bundles: Bundle[]; replies: Reply[] }) {
  const flights = useStore((s) => s.flights);
  const created = bundles.map((b) => b.created).filter(Boolean).sort()[0];
  const steps = LAYER_ORDER.map((l) => ({ layer: l, b: bundles.find((x) => x.layer === l) }));
  return (
    <div>
      <div className="num mb-2 text-[11px] text-fg-3">Queued on board {created ? `${utc(created)} UTC` : "—"}</div>
      <ol className="grid grid-cols-3">
        {steps.map(({ layer, b }, i) => {
          const st = stateOf(b, !!b && isInFlight(flights, b.bundle_id));
          return (
            <li key={layer} className="relative">
              <div className="flex items-center">
                <Dot state={st} />
                {i < 2 && <span className="mx-1.5 h-px flex-1" style={{ background: st === "received" ? COLORS.nominal : COLORS.lineStrong, opacity: st === "received" ? 0.5 : 1 }} />}
              </div>
              <div className="mt-1.5 text-[12px] font-medium text-fg-2">{LAYER_LABEL[layer]}</div>
              <div className="num text-[12px]" style={{ color: st === "received" ? COLORS.fg : COLORS.fg4 }}>
                {st === "received" ? utcTenths(b!.delivered_at) : st === "transit" ? "In transit" : "On board"}
              </div>
              <div className="num text-[11px] text-fg-4">{st === "received" ? `link ${fmtSpan(b!.sent_at, b!.delivered_at)}` : " "}</div>
            </li>
          );
        })}
      </ol>
      {replies.map((r) => {
        const st = stateOf(r, isInFlight(flights, r.reply_id));
        return (
          <div key={r.reply_id} className="num mt-2 flex items-center gap-2 text-[11px]">
            <Dot state={st} />
            <span className="shrink-0 text-fg-2">Reply</span>
            <span className="min-w-0 truncate text-fg-3">
              {st === "received" ? `delivered ${utcTenths(r.delivered_at)} · ${fmtSpan(r.sent_at, r.delivered_at)}` : st === "transit" ? `sent ${utcTenths(r.sent_at)}` : "queued on Earth · waiting for link"}
            </span>
          </div>
        );
      })}
    </div>
  );
}
