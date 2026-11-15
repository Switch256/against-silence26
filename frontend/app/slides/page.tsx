// The submission slides (NASA Space Apps: at most 7 slides including the title, in English).
// A plain web page so the link opens without a login; printing it gives the PDF (one slide per page).
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
      {/* 1. Title */}
      <section id="s1" className="slide" style={{ justifyContent: "flex-start" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="bg" src={img("hero-poster.jpg")} alt="" style={{ objectPosition: "50% 100%" }} />
        <div className="over">
          <h1>AEGIS-MEDLINK</h1>
          <p className="lead" style={{ color: "var(--color-fg)" }}>Care beyond connectivity: astronaut health monitoring that keeps working when Earth goes silent.</p>
          <p style={{ marginTop: "calc(var(--u) * 40)" }}>
            <strong>Team Against the Silence</strong> · Sivas, Türkiye<br />
            Asasira Martin · Mariam Saied · David Kitasho<br />
            Challenge: Create Health Monitoring Software for Astronauts on Space Missions
          </p>
          <p className="small" style={{ marginTop: "calc(var(--u) * 20)" }}>NASA International Space Apps Challenge 2026 · againstsilence.earth</p>
        </div>
      </section>

      {/* 2. Problem */}
      <section id="s2" className="slide">
        <h2>On the way to Mars, the doctor is minutes away. Sometimes weeks.</h2>
        <p className="lead">A crew member&apos;s heart rate climbs at rest. On the ISS, a flight surgeon sees it in seconds. In deep space, nobody on Earth may know.</p>
        <div className="cols c3">
          <div className="card"><div className="big">3–22</div><p>minutes for a signal to cross between Earth and Mars, one way. A question and its answer take twice that.</p></div>
          <div className="card"><div className="big">~2 weeks</div><p>of no contact at all when the Sun sits between Earth and Mars, about every 26 months.</p></div>
          <div className="card"><div className="big">0</div><p>medical events that can be allowed to get lost while the link is down.</p></div>
        </div>
        <N n={2} />
      </section>

      {/* 3. Solution */}
      <section id="s3" className="slide">
        <h2>Health monitoring that does not need Earth, and a link that loses nothing.</h2>
        <div className="cols c3">
          <div className="card"><h3>AEGIS</h3><p><strong>Knows each astronaut&apos;s normal.</strong> Checks every reading on board against that person&apos;s own baseline, says why it is unusual, and shows a doctor-written checklist of what to do now. Rules and statistics, no AI model, no link needed.</p></div>
          <div className="card"><h3>PulseBrief</h3><p><strong>Makes the first 120 bytes count.</strong> One event, three layers: headline, context, evidence. The headline crosses even the shortest contact window; the rest follows when there is room.</p></div>
          <div className="card"><h3>MEDLINK</h3><p><strong>Loses nothing.</strong> Real Bundle Protocol v7 between two delay-tolerant network nodes. When the link drops, bundles wait on board and cross when it returns. Doctors reply the same way.</p></div>
        </div>
        <p className="small" style={{ marginTop: "calc(var(--u) * 36)" }}>AEGIS = Astronaut Emergency Guidance and Intelligence System. A research prototype, not a medical device.</p>
        <N n={3} />
      </section>

      {/* 4. Demo */}
      <section id="s4" className="slide">
        <h2>It runs. Cut the link yourself.</h2>
        <div className="shots">
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="shot" src={img("shots/console-blackout.jpg")} alt="The live console during a blackout: link down, six bundles held on board, a heart-rate warning shown to the crew" />
            <p><strong>Link cut.</strong> AEGIS still raises the alert and guides the crew. Six bundles wait on board.</p>
          </div>
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="shot" src={img("shots/console-restored.jpg")} alt="The live console after the link returns: bundles delivered to the Earth console and a doctor's reply delivered to the crew" />
            <p><strong>Link restored.</strong> Headlines cross first, Earth sees the event, the doctors&apos; reply reaches the crew.</p>
          </div>
        </div>
        <p className="small" style={{ marginTop: "calc(var(--u) * 22)" }}>Screenshots of the live console at againstsilence.earth/demo. Crew vitals are simulated and labelled as simulated.</p>
        <N n={4} />
      </section>

      {/* 5. NASA data */}
      <section id="s5" className="slide">
        <h2>Built on NASA data, used in the build.</h2>
        <div className="cols c2">
          <div className="card"><h3>NASA DONKI space weather</h3><p>Real solar particle events, coronal mass ejections and geomagnetic storms feed AEGIS. A strong event raises an urgent alert with shelter guidance, and every PulseBrief carries the space-weather context. The demo can replay the real May 2024 storm.</p></div>
          <div className="card"><h3>NASA Deep Space Network</h3><p>The three real ground stations (Goldstone, Madrid, Canberra) with their coordinates; the serving station follows Earth&apos;s rotation.</p></div>
          <div className="card"><h3>NASA imagery and 3D models</h3><p>Blue Marble Earth and Deep Star Maps 2020 from the Scientific Visualization Studio; ISS, 34 m antenna and astronaut models from NASA 3D Resources.</p></div>
          <div className="card"><h3>NASA standards</h3><p>The console follows NASA-STD-3001 display guidance: colour only for meaning, plain words, every value labelled measured, NASA or simulated.</p></div>
        </div>
        <p className="small" style={{ marginTop: "calc(var(--u) * 30)" }}>Space weather is shown as environmental risk, not as crew radiation dose. Full list with links: ATTRIBUTIONS.md in the repository.</p>
        <N n={5} />
      </section>

      {/* 6. Validity */}
      <section id="s6" className="slide">
        <h2>What is real, measured on the running system.</h2>
        <div className="cols c4">
          <div className="card"><div className="big">128×</div><p>fewer bytes sent than the raw readings: 21 KB of PulseBriefs instead of 2.7 MB, in our test run.</p></div>
          <div className="card"><div className="big">0</div><p>events lost across repeated blackouts. Every bundle held on board was delivered and acknowledged.</p></div>
          <div className="card"><div className="big">~0.5 s</div><p>for a headline to cross once the link is up, between two real BPv7 nodes (dtn7-rs).</p></div>
          <div className="card"><div className="big">60</div><p>automated tests pass, covering detection, PulseBrief layers, the outbox and the crew record.</p></div>
        </div>
        <ul style={{ marginTop: "calc(var(--u) * 40)" }}>
          <li><strong>Explainable by design:</strong> each alert states the value, the personal baseline and the reason. Exercise and a loose sensor do not raise false alarms.</li>
          <li><strong>Honest limits:</strong> vitals are simulated, light delay is compressed for the demo, and this is not a medical device.</li>
        </ul>
        <N n={6} />
      </section>

      {/* 7. Impact and links */}
      <section id="s7" className="slide">
        <h2>During the silence, the astronaut is never alone.</h2>
        <p className="lead">The same design serves anyone far from a doctor with a poor connection: research stations, ships, remote clinics, disaster zones.</p>
        <div className="cols c3">
          <div className="card"><h3>Try it</h3><p><a href="https://againstsilence.earth">againstsilence.earth</a><br />Live console: /demo<br />Press &quot;Cut link&quot;, trigger an anomaly, restore the link.</p></div>
          <div className="card"><h3>Read it</h3><p><a href="https://github.com/Switch256/against-silence26">github.com/Switch256/against-silence26</a><br />Source code: FastAPI, PostgreSQL, Next.js, dtn7-rs, Blender.</p></div>
          <div className="card"><h3>Next</h3><p>Flight-like wearables, more vital signs, longer contact plans, and review of the checklists by flight surgeons.</p></div>
        </div>
        <div className="grow" />
        <p className="small"><strong>AI use:</strong> AI tools (ChatGPT, Claude) were used for brainstorming, writing and code. The idea, architecture and technical decisions are the team&apos;s; all results were verified by the team. No NASA endorsement is claimed.</p>
        <N n={7} />
      </section>
    </main>
  );
}
