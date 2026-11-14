"use client";
// "How it works": the 8 s Blender story clip (tools/blender/aegis_scene.py --mode story) with the four
// steps lit in sync with what is on screen: link drops -> PulseBrief layers appear -> held on board ->
// link returns, headline first, then the reply goes back up.
import { useEffect, useRef, useState } from "react";
import { BASE_PATH } from "@/lib/config";

/** Start of each step as a fraction of the clip (matches APPEAR / SEND / beam_level in aegis_scene.py). */
const STARTS = [0, 0.2, 0.36, 0.53];

export function StoryFilm({ steps }: { steps: string[][] }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [active, setActive] = useState(0);
  const [still, setStill] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setStill(mq.matches);
    const v = ref.current;
    if (!v || mq.matches) return;
    let raf = 0;
    const tick = () => {
      if (v.duration) {
        const f = v.currentTime / v.duration;
        let i = 0;
        STARTS.forEach((s, k) => { if (f >= s) i = k; });
        setActive(i);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    // play only while on screen
    const io = new IntersectionObserver(([e]) => (e.isIntersecting ? v.play().catch(() => {}) : v.pause()), { threshold: 0.25 });
    io.observe(v);
    return () => { cancelAnimationFrame(raf); io.disconnect(); };
  }, []);

  return (
    <div className="mt-5 grid items-center gap-6 md:grid-cols-[1.35fr_1fr]">
      <video
        ref={ref}
        className="aspect-video w-full rounded-[12px] bg-black object-cover"
        src={`${BASE_PATH}/media/story-media-720.mp4`}
        muted
        loop
        playsInline
        preload="metadata"
        controls={still}
        aria-label="Rendered sequence: the link drops, three PulseBrief layers wait on board, then cross to Earth headline first and a reply returns"
      />
      <ol className="grid gap-4">
        {steps.map(([t, d], i) => {
          const on = still || i === active;
          return (
            <li key={t} className="transition-opacity duration-500" style={{ opacity: on ? 1 : 0.4 }}>
              <div className="flex items-baseline gap-3">
                <span className="font-mono text-[12px]" style={{ color: on ? "var(--site-accent)" : "var(--site-muted)" }}>0{i + 1}</span>
                <span className="text-[18px] font-semibold tracking-tight">{t}</span>
              </div>
              <p className="mt-0.5 pl-[30px] text-[14px] leading-[1.5] text-[var(--site-muted)]">{d}</p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
