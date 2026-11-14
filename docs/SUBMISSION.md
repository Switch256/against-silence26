# Submission pack

Everything needed for **My Team → Project** on spaceappschallenge.org, ready to paste. All text is in
English, as the rules require. Deadline: **Sunday 15 November 2026, 23:59 (Türkiye time)**. Press
**Submit for Judging**: saving the page is not enough.

## Before you press submit

- [ ] Paste the sections below into the project page.
- [ ] Add the demo: the 30-second video **or** the slides (links below).
- [ ] Open every link in a private browser window. Each must load without a login.
- [ ] The GitHub repository is public.
- [ ] The server at againstsilence.earth runs the latest build (so `/slides`, the video and "Cut link" are there).
- [ ] Press **Submit for Judging**.

## Links

| What | Link |
| --- | --- |
| Project website | https://againstsilence.earth |
| Live console (the demo) | https://againstsilence.earth/demo |
| 30-second demo video | https://againstsilence.earth/media/aegis-medlink-demo-30s.mp4 |
| Slides (7, web page) | https://againstsilence.earth/slides |
| Slides (PDF) | https://againstsilence.earth/aegis-medlink-slides.pdf |
| Source code | https://github.com/Switch256/against-silence26 |
| NASA data and asset credits | https://github.com/Switch256/against-silence26/blob/main/ATTRIBUTIONS.md |

The video and slide links work once the server has the latest build. If the project page wants a video
on a video site, upload `frontend/public/media/aegis-medlink-demo-30s.mp4` to YouTube as "Unlisted" and
use that link.

## Project name

AEGIS-MEDLINK

## High-level summary

When a crew is on the way to Mars, a signal takes up to 22 minutes to reach Earth, and for about two
weeks around solar conjunction there is no contact at all. A medical event cannot wait for that.
AEGIS-MEDLINK is health-monitoring software built for the silence. **AEGIS** runs on board and needs no
link: it learns each astronaut's own normal, flags unusual readings with a plain reason, and shows a
doctor-written checklist of what to do now. **PulseBrief** packs each event into three layers (headline,
context, evidence) so the most important 120 bytes cross even the shortest contact window. **MEDLINK**
carries them over real Bundle Protocol v7 delay-tolerant networking: when the link drops, bundles wait on
board and cross when contact returns, and the doctors' reply comes back the same way. Nothing is lost,
and during the silence the astronaut is never alone.

## Project details

**What it does.** A simulated wrist sensor streams heart rate and blood oxygen once a second. AEGIS
(Astronaut Emergency Guidance and Intelligence System) compares every reading with that astronaut's
personal resting baseline, taking activity and signal quality into account, so exercise or a loose
sensor does not raise a false alarm. When a reading is unusual it raises an alert that states the value,
the baseline and the reason, and shows approved guidance. If the crew does not answer an "Are you OK?"
check, AEGIS escalates by itself.

Each alert becomes a PulseBrief with three layers of rising size. Over a normal link all three cross in
about half a second. In a short contact window with a small byte budget, headlines go first. With no
link, every bundle is held on board and delivered, in priority order, when contact returns. The Earth
console shows each brief's life cycle, the evidence chart, and a reply box; the reply travels back to
the crew over the same link.

**How it works.** A FastAPI backend with PostgreSQL does the health-data processing with rules and
statistics (personal baselines, thresholds, deviation scores). No AI model is used on board, so every
alert can be explained. Two dtn7-rs nodes carry real BPv7 bundles between "spacecraft" and "Earth". The
Next.js console shows the crew view, a live 3D scene of the mission and the Earth console side by side.
A "Cut link" switch lets anyone cause a blackout and watch the system cope. A crew record keeps every
measurement with its time and exports it as CSV or JSON.

**Benefits.** The crew gets guidance at once, without Earth. Flight surgeons get the headline first and
the full evidence when bandwidth allows. In our test run the system sent 21 KB of PulseBriefs in place
of 2.7 MB of raw readings, and lost no event across repeated blackouts. The same design fits any place
far from a doctor with a poor connection: research stations, ships, remote clinics, disaster zones.

**Limits, stated plainly.** Crew vitals are simulated and labelled as simulated. The light delay is
compressed for the demo. Space weather is shown as environmental risk, not as crew radiation dose. This
is a research prototype, not a medical device.

**Tools.** Python, FastAPI, PostgreSQL, Alembic, dtn7-rs (BPv7), Next.js, React Three Fiber, Tailwind
CSS, Blender.

## Use of NASA data

NASA data is part of the running system, not only cited:

- **NASA DONKI** (Space Weather Database Of Notifications, Knowledge, Information; api.nasa.gov): real
  solar energetic particle events, coronal mass ejections, geomagnetic storms and radiation belt
  enhancements. AEGIS turns them into an environment status; a strong event raises an urgent alert with
  shelter guidance, and every PulseBrief carries the space-weather context. The demo can replay the real
  May 2024 solar storm.
- **NASA Deep Space Network**: the three real complexes (Goldstone, Madrid, Canberra) with their
  coordinates; the serving station follows Earth's rotation.
- **NASA Scientific Visualization Studio**: Blue Marble (SVS 2915) for the Earth, Deep Star Maps 2020
  (SVS 4851) for the sky, the CGI Moon Kit (SVS 4720).
- **NASA 3D Resources**: the ISS, 34 m antenna, astronaut and Mars models and textures.
- **NASA standards**: the console follows the display guidance in NASA-STD-3001 Volume 2 (Appendix F)
  and the Human Integration Design Handbook. No certification or endorsement is claimed.

Full list with links: `ATTRIBUTIONS.md` in the repository.

## Space agency partner and other data

BPv7 follows RFC 9171 (the Bundle Protocol used for delay-tolerant networking in space). Star positions
in the NASA sky map come from the Hipparcos-2, Tycho-2 and Gaia DR2 catalogues.

## Use of artificial intelligence

AI tools (ChatGPT, Claude) were used for brainstorming, writing and code. The idea, architecture and
technical decisions are the team's; all results were verified by the team. The product itself contains
no AI model: AEGIS uses rules and statistics. Images and videos were rendered by the team in Blender
from NASA models and imagery; no AI-generated images are used and no NASA logo appears in them.

## Team

Against the Silence · Sivas, Türkiye

- Asasira Martin (lead): backend, health-data processing (AEGIS), MEDLINK
- Mariam Saied: frontend
- David Kitasho: testing and demo scenarios

## Re-making the demo files

- Video: `Blender -b -P tools/blender/demo_video.py` writes `frontend/public/media/aegis-medlink-demo-30s.mp4` (29 s, 1080p).
- Slides PDF: open `/slides` in Chrome and print to PDF (the page sets the 16:9 page size), or run headless Chrome with `--print-to-pdf`.
- Console screenshots: `docs/media/shots/`.
