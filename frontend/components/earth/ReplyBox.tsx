"use client";
// The doctor's reply to the crew. It travels back over the same BPv7 link.
import { useState } from "react";
import { useMission } from "@/hooks/useMission";
import type { Reply } from "@/lib/api";
import { SendIcon } from "@/components/ui/icons";
import { StatusText } from "@/components/ui/Status";

const QUICK = ["Rest 15 min, then re-measure.", "Drink 500 ml water and report back.", "Seen. Keep monitoring, we are with you."];

function ReplyState({ r }: { r: Reply }) {
  if (r.delivered_at || r.status === "delivered") return <StatusText level="nominal" className="!font-normal">Delivered to crew</StatusText>;
  if (r.sent_at || r.status === "in_transit") return <span className="text-fg-3">In transit to crew</span>;
  return <StatusText level="caution" className="!font-normal">Queued on Earth · waiting for link</StatusText>;
}

export function ReplyBox({ briefId, replies }: { briefId: string; replies: Reply[] }) {
  const { actions } = useMission();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const send = async (t: string) => {
    if (!t.trim()) return;
    setSending(true);
    await actions.reply(briefId, t.trim());
    setText("");
    setSending(false);
  };
  return (
    <div className="space-y-2">
      {replies.map((r) => (
        <div key={r.reply_id} className="rounded bg-raised px-3 py-2">
          <p className="text-[13px] leading-5">{r.text}</p>
          <div className="mt-1 text-[12px]"><ReplyState r={r} /></div>
        </div>
      ))}
      <div className="flex flex-wrap gap-1.5">
        {(replies.length ? QUICK.slice(0, 1) : QUICK).map((q) => (
          <button key={q} disabled={sending} onClick={() => send(q)} className="h-7 rounded border border-line px-2.5 text-[12px] text-fg-2 hover:border-line-strong hover:text-fg">
            {q}
          </button>
        ))}
      </div>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); send(text); }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={500}
          placeholder="Write to the crew…"
          className="h-9 min-w-0 flex-1 rounded border border-line-strong bg-sunken px-3 text-[13px] outline-none focus:border-accent"
        />
        <button type="submit" disabled={sending || !text.trim()} className="btn btn-primary !h-9">
          <SendIcon className="h-4 w-4" /> Send
        </button>
      </form>
    </div>
  );
}
