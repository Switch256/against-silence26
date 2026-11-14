"use client";
// Landing page: clear and short (one idea per section, few words), in our own visual language
// (graphite, hairline cards, the console's blue accent), led by a Blender-rendered loop of AEGIS-1 over Earth (tools/blender).
import Link from "next/link";
import { HeroFilm } from "@/components/landing/HeroFilm";
import { StoryFilm } from "@/components/landing/StoryFilm";

const PLAN_URL = "https://switch256.github.io/against-silence26/";
const REPO_URL = "https://github.com/Switch256/against-silence26";
const ATTRIBUTIONS_URL = `${REPO_URL}/blob/main/ATTRIBUTIONS.md`;

const STEPS = [
  ["Detect", "AEGIS spots a reading that is unusual for this astronaut."],
  ["Brief", "The event becomes a PulseBrief: headline, context, evidence."],
  ["Hold", "Link down. It waits on board. Nothing is lost."],
  ["Deliver", "Contact returns. Headline first. Doctors reply."],
];
const PARTS = [
  ["AEGIS", "knows each astronaut's normal.", "Checks every reading on board against the astronaut's own baseline, says why, and shows what to do now. No link needed."],
  ["PulseBrief", "makes the first 120 bytes count.", "One event, three layers. The headline crosses even the shortest contact window; context and evidence follow."],
  ["MEDLINK", "loses nothing.", "Real BPv7 bundles between dtn7-rs nodes. When the link drops they wait on board and cross when it returns."],
];

export default function Landing() {
  return (
    <main className="site min-h-dvh">
      <header className="absolute inset-x-0 top-0 z-20">
        <div className="mx-auto flex h-14 max-w-[1080px] items-center justify-between px-5 text-[13px]">
          <span className="flex items-center gap-2 text-[14px] font-semibold tracking-tight">
            <span className="h-2 w-2 rounded-full bg-[var(--site-accent)]" /> AEGIS-MEDLINK
          </span>
          <nav className="flex items-center gap-6 text-[var(--site-muted)]">
            <a href="#how" className="hidden hover:text-white sm:inline">How it works</a>
            <a href="#nasa" className="hidden hover:text-white sm:inline">NASA data</a>
            <a href={PLAN_URL} className="hidden hover:text-white sm:inline" target="_blank" rel="noreferrer">Plan</a>
            <Link href="/demo" className="site-btn site-btn-sm">Launch demo</Link>
          </nav>
        </div>
      </header>

      {/* hero: the planet from orbit */}
      <section className="site-stars relative h-[min(860px,100dvh)] min-h-[620px] overflow-hidden">
        <HeroFilm />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-full bg-[radial-gradient(ellipse_at_50%_8%,rgba(11,13,14,0.7),rgba(11,13,14,0)_50%)]" />
        <div className="relative z-10 mx-auto max-w-[1080px] px-5 pt-[clamp(88px,14vh,140px)] text-center">
          <h1 className="mx-auto max-w-[860px] text-[42px] leading-[1.05] font-semibold tracking-[-0.025em] md:text-[66px]">
            Care beyond connectivity.
          </h1>
          <p className="mx-auto mt-4 max-w-[600px] text-[18px] leading-[1.5] text-[var(--site-muted)]">
            Astronaut health monitoring that keeps working when Earth goes silent, and gets every medical event home, headline first.
          </p>
          <div className="pointer-events-auto mt-7 flex items-center justify-center gap-3">
            <Link href="/demo" className="site-btn">Launch the live demo</Link>
            <a href={PLAN_URL} className="site-btn site-btn-ghost" target="_blank" rel="noreferrer">Technical plan</a>
          </div>
        </div>
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-[var(--site-bg)]" />
      </section>

      {/* how it works */}
      <section id="how" className="mx-auto max-w-[1080px] px-5 pb-4">
        <div className="site-card">
          <h2 className="site-title">From silence to care, in four steps.</h2>
          <StoryFilm steps={STEPS} />
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {PARTS.map(([k, t, d]) => (
            <article key={k} className="site-card">
              <h3 className="site-title"><span className="text-[var(--site-accent)]">{k}</span> {t}</h3>
              <p className="site-text">{d}</p>
            </article>
          ))}
        </div>
      </section>

      {/* NASA data + honesty */}
      <section id="nasa" className="mx-auto max-w-[1080px] px-5 pb-10">
        <div className="grid gap-3 md:grid-cols-2">
          <article className="site-card">
            <h3 className="site-title">Real NASA space weather.</h3>
            <p className="site-text">
              NASA DONKI solar particle events, CMEs and storms set the crew&apos;s radiation environment in every PulseBrief, including a replay of May 2024.
              Models from NASA 3D Resources; Earth, Moon and Mars imagery from NASA.
            </p>
            <a href={ATTRIBUTIONS_URL} className="mt-3 inline-block text-[14px] text-[var(--site-accent)] hover:underline" target="_blank" rel="noreferrer">Attributions →</a>
          </article>
          <article className="site-card">
            <h3 className="site-title">Honest about what it is.</h3>
            <p className="site-text">
              Vitals are simulated and labelled. Space weather is environmental risk, not a crew dose. A hackathon prototype, not a medical device.
              No NASA endorsement implied. AI helped with writing and code; the idea and decisions are ours.
            </p>
          </article>
        </div>
      </section>

      <footer>
        <div className="mx-auto flex max-w-[1080px] flex-wrap items-center justify-between gap-3 px-5 py-4 text-[12px] text-[var(--site-dim)]">
          <span>Team Against the Silence · NASA Space Apps Challenge 2026 · Sivas, Türkiye · Asasira Martin · Mariam Saied · David Kitasho</span>
          <span className="flex gap-4">
            <a href={REPO_URL} className="hover:text-white" target="_blank" rel="noreferrer">GitHub</a>
            <a href={ATTRIBUTIONS_URL} className="hover:text-white" target="_blank" rel="noreferrer">Attributions</a>
          </span>
        </div>
      </footer>
    </main>
  );
}
