---
layout: default
title: AEGIS-MEDLINK — Background & Technical Plan
description: Offline astronaut health monitoring with delay-tolerant medical communication over BPv7. Team Against the Silence, NASA Space Apps 2026.
image: /assets/preview.png
---

# AEGIS-MEDLINK — Background & Technical Plan

Team Against the Silence · NASA Space Apps 2026 · Nov 1, 2026 · Asasira Martin

> ✏️ This page is the team's living plan. To change it, [edit `docs/index.md` on GitHub](https://github.com/Switch256/against-silence26/edit/main/docs/index.md) and commit. Questions, ideas or problems: [open an issue](https://github.com/Switch256/against-silence26/issues/new/choose).

## Our story

<div class="story" markdown="1">

An astronaut is millions of kilometres from Earth. Their health measurements begin showing an unusual pattern. Communication with Earth is interrupted.

**AEGIS** (*Astronaut Emergency Guidance and Intelligence System*) continues monitoring locally, generates a medical context report, and **MEDLINK** preserves the information.

When connectivity returns, the prioritized message reaches Earth. The medical team can review the event and send a response.

<p class="story-tag">Care Beyond Connectivity.</p>

</div>

## How it works

Health readings come in from our simulator (or a wearable, if we have time). The spacecraft checks them on board. If something is wrong, a message goes to doctors on Earth, and if the link is down, the message waits and is never lost.

{% include intro.html %}

| | Part | In one line |
| --- | --- | --- |
| ⌚ | Health input | Simulator readings shaped by NASA research; a Bluetooth heart-rate sensor is an optional bonus |
| 🧠 | AEGIS | On the spacecraft: learns each astronaut's normal and flags what isn't |
| 📨 | MEDLINK | Packs alerts into PulseBriefs, keeps them safe, sends the most urgent first when Earth can hear |
| 🌍 | Two dashboards | Web apps (PWA): the astronaut dashboard on board, the Earth console for doctors |

## Background

On long missions, astronauts must spot health problems themselves, often when Earth cannot answer quickly or at all.

Our challenge, **Create Health Monitoring Software for Astronauts on Space Missions**, asks for software that gathers health indicators and lets astronauts evaluate and act on their health. NASA names the risks: radiation, isolation and confinement, altered gravity and a closed environment, leading to immune changes, bone loss, cardiovascular events and behavioural health problems.

Connectivity makes this harder. A one-way signal between Earth and Mars takes roughly 4 to 24 minutes (approximate, depends on planet positions), and links drop during blackouts and contact gaps. A monitoring app that needs the cloud, or loses messages when the link drops, fails exactly when it matters.

**Problem statement:** How can an astronaut health system keep giving useful decision support onboard, and keep medical information flowing reliably to and from Earth, when the link is delayed, interrupted or limited?

## What we are building

AEGIS-MEDLINK is two parts that share one message format: AEGIS thinks onboard, MEDLINK carries messages to and from Earth.

- **AEGIS, Astronaut Emergency Guidance and Intelligence System:** the onboard intelligence component, responsible for monitoring physiological data, detecting anomalies and generating medical alerts. It reads vitals, compares them with each astronaut's own normal using simple rules and statistics (no AI model), flags unusual readings with a plain-language reason, and shows approved guidance. Runs fully offline on a normal CPU.
- **MEDLINK (delay-tolerant medical link):** turns flagged events into prioritised, signed messages, stores them safely, and delivers them over BPv7 (NASA's delay-tolerant Bundle Protocol) whenever a link is available. Earth replies travel back the same way.
- **Two consoles:** a spacecraft console for the crew and an Earth medical console for the simulated flight-surgeon team.

**What we will not claim:** that the prototype diagnoses anything, that it is flight-ready, or that we solved spacecraft connectivity. We build on NASA's existing delay-tolerant networking (DTN) work, use public or clearly labelled synthetic data, and keep humans in charge of medical decisions.

## Our special touch: PulseBrief

**A health message built for a broken, slow link.** Most health apps send raw numbers: `heart_rate: 110` tells Earth what happened, but not whether it matters. AEGIS sends a **PulseBrief** instead: one small message that explains the event, split so the most important part always gets through first.

> *During the silence, the astronaut is never alone: AEGIS says what to do now, MEDLINK guarantees the message, and PulseBrief makes the first 200 bytes count.*

### 1. Three layers, headline first

Each PulseBrief travels as three BPv7 bundles. If the link opens for only a few seconds, Earth still gets the headline; the rest follows in the next window.

| Layer | What it holds | Size (estimate) | Sent |
| --- | --- | --- | --- |
| 🔴 Headline | Who, what changed, how urgent, signal quality | ~200 bytes | First, always |
| 🟠 Context | Sleep, exercise, oxygen, the astronaut's check-in | ~1 KB | Next |
| 🔵 Evidence | Readings before and after the event | a few KB | When there is room |

For comparison, 10 minutes of raw readings at one per second is roughly 15–20 KB of JSON. These are estimates; we measure the real numbers at the hackathon.

### 2. The astronaut is never left waiting in silence

- **What to do now:** AEGIS shows a short checklist written in advance by doctors (sit down, re-measure in 5 minutes, drink water). Not AI-invented advice.
- **3-tap check-in:** "How do you feel?" fine / a bit off / unwell, plus one symptom. It becomes the "astronaut says" line in the brief.
- **Reply countdown:** from the signal delay and the next link window, the crew screen shows when Earth will see the brief and when a reply can arrive.

### 3. Fewer false alarms

- **Signal quality first:** a loose watch or movement makes readings jump. AEGIS checks this before alerting and marks each brief "signal: good / poor".
- **Activity-aware:** a fast heart rate during exercise is normal; at rest it is not.

### What it looks like

{% include pulsebrief.html %}

### What we build first

| Priority | Feature | Who |
| --- | --- | --- |
| Must | Layered PulseBrief: headline, context, evidence | Martin |
| Must | 3-tap check-in and "what to do now" screen | Mariam (UI), Martin (logic) |
| Must | "Reply expected in" countdown | Mariam |
| Nice | Signal-quality check and activity-aware alerts | Martin |
| Nice | Short-window demo: only the headline gets through | Martin, David runs it |

**What we will prove on stage:** the headline reaches Earth even in a very short link window, nothing is lost across a blackout, and how many bytes a PulseBrief sends compared with raw readings.

**About the data:** NASA does not publish live astronaut vitals; medical records are private. We use NASA research ([Open Science Data Repository](https://osdr.nasa.gov/), [Human Research Program](https://www.nasa.gov/hrp/), [NASA Life Sciences Portal](https://www.nasa.gov/hrp/nlsp/)) for realistic ranges and context, plus simulated readings that are clearly labelled as simulated.

## System flow

![No medical event is lost when the link to Earth drops](assets/system-flow.svg)

1. Vitals come in from the BLE sensor or the simulator.
2. AEGIS compares them with the astronaut's baseline and flags anything unusual, with a reason, on the crew console.
3. MEDLINK signs the event, sets its priority and hands it to the BPv7 node, which keeps it on disk until a link is up.
4. Earth's node receives it, drops duplicates and acknowledges it; the medical console shows it for review.
5. The reviewer's signed guidance travels back the same way and appears on the crew console.

## Technology stack

Everything runs on laptops with Docker; no GPU and no cloud service is needed for the demo.

| Component | Technologies | Why |
| --- | --- | --- |
| Health input | Built-in simulator (guaranteed), NASA-derived scenario, optional BLE heart-rate sensor (Python `bleak` or Web Bluetooth) | The demo never depends on hardware; one real sensor is a bonus |
| AEGIS (health-data processing) | Python, FastAPI, pandas (rolling baselines, simple thresholds, z-scores) | Fast on CPU, easy to explain, no model to train |
| Local storage | SQLite (events, vitals, audit log) | One file, survives restarts |
| MEDLINK | Python FastAPI service + dtn7-rs BPv7 daemon (`dtnd`) over its local HTTP API | Real BPv7 bundles, store-and-forward, persistent bundle store |
| Link simulator | Docker network + Linux `tc netem` (delay, loss), scheduled link windows | Repeatable blackouts and delays on stage |
| Astronaut dashboard + Earth console | Next.js PWA (React, TypeScript), Tailwind, Recharts | Installable web app, no app store; the astronaut app talks to the onboard backend, the Earth console to the Earth side |
| Shared contracts | JSON Schema for events, OpenAPI for each service | Lets everyone build in parallel against mocks |
| Security | Ed25519 message signing, encryption at rest for stored events | Earth can trust who sent what |
| Delivery | GitHub, GitHub Actions, Docker Compose | One command starts the whole demo |

## BPv7 feasibility result

BPv7 works for MEDLINK: on 1 Nov 2026 all four tests passed with two real BPv7 nodes, so we use the real protocol, not fake delays over HTTP.

Setup: two [dtn7-rs](https://github.com/dtn7/dtn7-rs) 0.21.0 daemons in Docker, `dtn://spacecraft` and `dtn://earth`, TCP link between them, persistent bundle store (sled). Test payloads were sample JSON medical events.

| Test | What we did | Result |
| --- | --- | --- |
| A. Normal delivery | Send one event, link up | Delivered in about 1 s |
| B. Blackout | Cut the link, send, wait 8 s, restore | Held on spacecraft, delivered about 6 s after restore |
| C. Restart during blackout | Cut link, send, kill and restart spacecraft node, restore | Bundle survived on disk, delivered after restore |
| D. Added latency | 3 s one-way delay with `tc netem` | Delivered in about 4 s |

**What this means for the build:**

- The node needs peer IP addresses, not hostnames (hostnames crashed the first run), so the Compose file pins IPs.
- TCP will not survive a real 12-minute delay. For the demo we compress time and model link windows; we name LTP (the protocol real deep-space DTN uses) as future work.
- A bundle can arrive more than once, so Earth de-duplicates by `event_id` and sends its own signed acknowledgement back.
- NASA's own implementation, [HDTN](https://github.com/nasa/HDTN), is a later option if we want to show interoperability.

## Repository and collaboration

One repository, [Switch256/against-silence26](https://github.com/Switch256/against-silence26) (a monorepo): each part gets its own folder and owner, not its own repo.

Why one repo: with three people and 48 hours, separate backend and frontend repos mean extra setup, version drift and harder integration. One repo gives one CI pipeline, one `docker compose up`, and contract changes that land in the same pull request as the code that uses them.

```text
against-silence26/
├── contracts/          # JSON Schemas + OpenAPI (shared, reviewed by all)
├── services/
│   ├── aegis/          # health-data processing (Python)
│   ├── medlink/        # BPv7 gateway (Python + dtnd)
│   └── simulator/      # sensors, link outages, delays
├── apps/
│   ├── spacecraft/     # crew console (Next.js)
│   └── earth-console/  # medical console (Next.js)
├── tests/integration/
├── docs/
├── docker-compose.yml
└── .github/            # CI workflows, CODEOWNERS, PR template
```

**How we work:**

- Short branches named `owner/feature`, small pull requests, one review, merge to `main` often. `main` always runs.
- `CODEOWNERS` routes each folder's reviews to its owner; any change under `contracts/` needs everyone.
- Every pull request runs schema checks, Python tests, frontend build and a smoke test in GitHub Actions.
- Each service ships mock data from day one, so nobody waits on anybody.
- Before 14 November the repo holds only docs, contract drafts and learning notes; product code starts at the hackathon, in line with Space Apps guidance.

## Team roles

Three people, three clear lanes. Each lane plugs into the others through the shared contracts, so nobody waits on anybody.

| Person | Owns | Delivers by Sunday 15:00 |
| --- | --- | --- |
| **Asasira Martin** (lead) | FastAPI backend, health-data processing (AEGIS), BLE integration, MEDLINK | Data in → AEGIS alert → PulseBrief → BPv7 delivery, with the blackout simulator |
| **Mariam Saied** | Next.js frontend: the astronaut dashboard and the Earth console | Both screens as a PWA, working against mock data first, then the live API |
| **David Kitasho** | End-to-end testing, demo scenarios, bug reporting | Test checklist, the demo script, bugs filed as issues, screenshots for the slides |

**Want a role, or want to change yours?** [Request a role](https://github.com/Switch256/against-silence26/issues/new?template=role.yml). Anything else (a question, a blocker, an idea): [open an issue](https://github.com/Switch256/against-silence26/issues/new/choose).

## Hackathon weekend

**Build less, demonstrate more, document everything.** NASA Space Apps Sivas runs 14–15 November 2026, in person at Sivas Cumhuriyet University. Every team member must be there both days.

| When | What |
| --- | --- |
| Sat 14 Nov, 09:00 | NASA project page opens (My Team → Project). Start filling it in and save often |
| Sat 14 Nov, 10:00 | Opening at 100. Yıl Kültür Merkezi. Attendance is taken |
| Sat 14 Nov, ~13:00 | Work starts in the Engineering Faculty, Building B labs, through the night |
| Sun 15 Nov, 15:00 | Work ends. Local presentations: 5 min + 2 min questions, in Turkish |
| Sun 15 Nov, 23:59 | **Click "Submit for Judging"** on spaceappschallenge.org. Saving is not enough |

### What we ship (the MVP)

- **Guaranteed:** simulated astronaut readings shaped by NASA research → AEGIS anomaly detection → PulseBrief → BPv7 store-and-forward → the two dashboards.
- **Also in:** a blackout switch the judges can press, a live count of queued and delivered messages, and real bytes sent per PulseBrief.
- **Only if time allows:** a live wearable. A standard BLE heart-rate sensor works through the backend or Web Bluetooth in Chrome. An Apple Watch would need a small native iPhone app, because browsers (and Safari PWAs) cannot read HealthKit or use Web Bluetooth on iPhone.
- **Data source selector** on the dashboard: synthetic readings / NASA-derived scenario / wearable (optional).

### Rules we must not miss

- **NASA data is required** for global awards: at least one NASA resource, used in the build and explained, not just cited. Simulated readings stay labelled as simulated.
- **Everything uploaded is in English** (project page, slides). The local talk is in Turkish.
- **Demo:** a video of at most 30 seconds, or at most 7 slides including the title. Slides show the team name, members and challenge.
- **AI use must be disclosed** on the project page. The idea is ours; we say where AI helped (brainstorming, writing, code). No NASA logo in generated images.
- **Links must open without a login.** Test them in a private browser window before submitting.
- **Judged on:** Impact, Creativity, Validity, Relevance (real NASA data use) and Presentation, each 1–5.

## Sources

- [dtn7-rs (BPv7 daemon)](https://github.com/dtn7/dtn7-rs)
- [NASA HDTN](https://github.com/nasa/HDTN)
- [NASA Open Science Data Repository](https://osdr.nasa.gov/)
- [NASA Human Research Program](https://www.nasa.gov/hrp/)
- [NASA Life Sciences Portal](https://www.nasa.gov/hrp/nlsp/)
