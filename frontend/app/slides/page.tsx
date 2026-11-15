// The submission slides (NASA Space Apps: at most 7 slides including the title, in English).
// A plain web page so the link opens without a login; printing it gives the PDF (one slide per page).
// Built around the Global Awards it fits: Best Mission Concept, Best Use of Data, Galactic and Local Impact.
import type { Metadata } from "next";
import { BASE_PATH } from "@/lib/config";
import "./slides.css";

export const metadata: Metadata = {
  title: "Slides",
  description: "AEGIS-MEDLINK in seven slides. Team Against the Silence, NASA Space Apps Challenge 2026.",
  alternates: { canonical: "/slides" },
};

const img = (p: string) => `${BASE_PATH}/media/${p}`;
const N = ({ n }: { n: number }) => <span className="num">{n} / 7</span>;

export default function Slides() {
  return (
    <main className="deck">
      {/* 1. Title, with the challenge named in full */}
      <section id="s1" className="slide" style={{ justifyContent: "flex-start" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="bg" src={img("hero-poster.jpg")} alt="" style={{ objectPosition: "50% 100%" }} />
        <div className="over">
          <h1>AEGIS-MEDLINK</h1>
          <p className="lead" style={{ color: "var(--color-fg)" }}>Astronaut health monitoring that keeps working when Earth goes silent.</p>
          <p className="challenge">Challenge: <strong>Create Health Monitoring Software for Astronauts on Space Missions</strong></p>
          <p style={{ marginTop: "calc(var(--u) * 28)" }}>
            <strong>Team Against the Silence</strong> · Sivas, Türkiye<br />
            Asasira Martin · Mariam Saied · David Kitasho
          </p>
          <p className="small" style={{ marginTop: "calc(var(--u) * 20)" }}>NASA International Space Apps Challenge 2026 · againstsilence.earth</p>
        </div>
      </section>

      {/* 2. One person, one moment */}
      <section id="s2" className="slide">
        <h2>Day 182. Aylin&apos;s heart rate is climbing at rest.</h2>
        <p className="lead">On the ISS, a flight surgeon would see it in seconds. Aylin is 250 million km out. Earth will not hear for 14 minutes, and around solar conjunction, not for two weeks.</p>
        <div className="cols c3">
          <div className="card"><div className="big">3–22 min</div><p>for a signal to cross between Earth and Mars, one way. A question and its answer take twice that.</p></div>
          <div className="card"><div className="big">~2 weeks</div><p>with no contact at all when the Sun sits between Earth and Mars, about every 26 months.</p></div>
          <div className="card"><div className="big">0</div><p>medical events that can be allowed to get lost while the link is down.</p></div>
        </div>
        <p className="small" style={{ marginTop: "calc(var(--u) * 30)" }}>Aylin Kaya is a fictional crew member. Her readings are simulated.</p>
        <N n={2} />
      </section>

      {/* 3. The answer, and why it could fly */}
      <section id="s3" className="slide">
        <h2>Care that does not wait for Earth, and a link that loses nothing.</h2>
        <div className="cols c3">
          <div className="card"><h3>AEGIS</h3><p><strong>Knows each astronaut&apos;s normal.</strong> Checks every reading on board against that person&apos;s own baseline, says why it is unusual, and shows what to do now. Rules and statistics, no AI model, no link needed.</p></div>
          <div className="card"><h3>PulseBrief</h3><p><strong>Headline first.</strong> Each event is sent in three layers: headline (about 120 bytes), context, evidence. The headline fits even the shortest contact window.</p></div>
          <div className="card"><h3>MEDLINK</h3><p><strong>Loses nothing.</strong> When the link drops, briefs wait on board and cross when it returns, most urgent first. The doctors&apos; reply comes back the same way.</p></div>
        </div>
        <div className="band">
          <strong>Built on what NASA already flies.</strong> NASA runs delay-tolerant networking on the ISS today. MEDLINK uses the current standard, Bundle Protocol v7 (RFC 9171), between two real network nodes, not a mock-up.
        </div>
        <N n={3} />
      </section>

      {/* 4. The working system, with the numbers in plain words */}
      <section id="s4" className="slide">
        <h2>It runs. Cut the link yourself.</h2>
        <div className="shots">
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="shot" src={img("shots/console-blackout.jpg")} alt="The live console during a blackout: link down, bundles held on board, a heart-rate warning shown to the crew" />
            <p><strong>Link cut.</strong> AEGIS still raises the alert and guides the crew. The briefs wait on board.</p>
          </div>
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="shot" src={img("shots/console-restored.jpg")} alt="The live console after the link returns: briefs delivered to the Earth console and a doctor's reply delivered to the crew" />
            <p><strong>Link back.</strong> Headlines cross first, Earth sees the event, the doctors&apos; reply reaches the crew.</p>
          </div>
        </div>
        <div className="cols c3 facts">
          <div><strong>2.7 MB → 21 KB.</strong> Raw readings sent as PulseBriefs: 128 times smaller, nothing lost.</div>
          <div><strong>0 events lost</strong> across repeated blackouts. Every brief held on board was delivered.</div>
          <div><strong>About half a second</strong> for a headline to cross once the link is up. 60 automated tests pass.</div>
        </div>
        <N n={4} />
      </section>

      {/* 5. NASA data at work */}
      <section id="s5" className="slide">
        <h2>Real NASA data, real alert.</h2>
        <div className="split">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="shot" src={img("shots/console-donki-replay.jpg")} alt="The live console replaying the real May 2024 solar particle events from NASA DONKI: a space-weather warning on board and the PulseBrief on the Earth console" />
          <div>
            <p><strong>NASA DONKI space weather drives AEGIS.</strong> Replaying the real May 2024 solar storm, two solar particle events raise an urgent warning on board with shelter steps, and every PulseBrief carries the space-weather context to Earth.</p>
            <ul style={{ marginTop: "calc(var(--u) * 28)" }}>
              <li><strong>Deep Space Network:</strong> the three real stations, Goldstone, Madrid and Canberra. The serving one follows Earth&apos;s rotation.</li>
              <li><strong>NASA imagery and 3D models:</strong> Blue Marble, Deep Star Maps 2020, the ISS, a 34 m antenna, the astronaut.</li>
              <li><strong>NASA-STD-3001:</strong> its display guidance shapes the console.</li>
            </ul>
          </div>
        </div>
        <p className="small" style={{ marginTop: "calc(var(--u) * 24)" }}>Space weather is shown as environmental risk, not as a crew radiation dose. Full source list: ATTRIBUTIONS.md in the repository.</p>
        <N n={5} />
      </section>

      {/* 6. The same problem on Earth */}
      <section id="s6" className="slide">
        <h2>The same silence exists on Earth.</h2>
        <p className="lead">Anywhere people are far from a doctor and the connection is poor, the same design keeps watch and gets the news through.</p>
        <div className="cols c4">
          <div className="card"><h3>Ships at sea</h3><p>Crews weeks from port, on costly, patchy satellite links.</p></div>
          <div className="card"><h3>Research stations</h3><p>Antarctic winter-overs with no way out for months.</p></div>
          <div className="card"><h3>Rural clinics</h3><p>Villages in Türkiye or Uganda where a specialist is hours away and data comes and goes.</p></div>
          <div className="card"><h3>Disaster zones</h3><p>Field teams after an earthquake, when networks are down.</p></div>
        </div>
        <p style={{ marginTop: "calc(var(--u) * 40)" }}><strong>Next:</strong> real wearables, more vital signs, longer contact plans, and checklists reviewed by flight surgeons.</p>
        <N n={6} />
      </section>

      {/* 7. Close: limits stated, links, AI use */}
      <section id="s7" className="slide">
        <h2>During the silence, the astronaut is never alone.</h2>
        <div className="cols c3">
          <div className="card"><h3>Try it</h3><p><a href="https://againstsilence.earth">againstsilence.earth</a><br />Live console: /demo<br />Press &quot;Cut link&quot;, trigger an anomaly, restore the link.</p></div>
          <div className="card"><h3>Read it</h3><p><a href="https://github.com/Switch256/against-silence26">github.com/Switch256/against-silence26</a><br />FastAPI, PostgreSQL, Next.js, dtn7-rs, Blender.</p></div>
          <div className="card"><h3>Honest limits</h3><p>Crew vitals are simulated and labelled. The light delay is shortened for the demo. A research prototype, not a medical device.</p></div>
        </div>
        <div className="grow" />
        <p className="small"><strong>AI use:</strong> the idea is the team&apos;s own. We used AI tools (ChatGPT, Claude) to refine it, and for research, code, writing, UI design and the demo materials; we checked every result. The product has no AI model. No NASA endorsement is claimed.</p>
        <N n={7} />
      </section>
    </main>
  );
}
