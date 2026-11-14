# Frontend handoff: AEGIS-MEDLINK API

For **Mariam** (Next.js PWA: astronaut dashboard + Earth console) and **David** (testing).
The backend is ready to build against. Full contract: [`openapi.json`](openapi.json), or live docs at `http://127.0.0.1:8001/docs`.

## Run the backend

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # then put in the real DATABASE_URL (ask Martin)
python run.py                 # migrates the database, serves http://127.0.0.1:8001
```

- `python run.py test` runs the backend tests.
- `http://127.0.0.1:8001/proto/` is a plain HTML test page that already uses every endpoint. Copy from it freely.
- CORS allows `http://localhost:3000`; the frontend below proxies through Next.js, so it does not depend on CORS.

## Run the frontend (mission-control UI)

```bash
cd frontend
npm install
npm run dev                   # http://localhost:3001  (port 3000 is taken)
```

- Needs the backend on `http://127.0.0.1:8001`. Another URL: `NEXT_PUBLIC_API_URL=http://host:port npm run dev`
  (see `.env.example`). The browser calls `/backend/*` on port 3001 and Next.js forwards it to the backend,
  so CORS settings do not matter.
- `npm run build` checks types and builds for production; `npm run start` serves the build on port 3001.
- `?view=spacecraft` or `?view=earth` in the URL picks the opening camera (handy when presenting).
- Code map: `hooks/useMission.ts` (one 1 s polling loop + actions), `lib/api.ts` (typed client),
  `lib/store.ts` (snapshots -> packet animations, link state, mission log), `components/scene/*` (3D),
  `components/hud/*` (overlay panels). Layout and camera presets: `lib/sceneLayout.ts`.

## Endpoints

| Screen | Method & path | What it does |
| --- | --- | --- |
| Astronaut | `GET /api/spacecraft` | **Everything the astronaut dashboard needs in one call.** Poll every 1–2 s |
| Astronaut | `POST /api/checkin` | `{ "feeling": "fine" \| "a_bit_off" \| "unwell", "symptom": "dizzy" }` |
| Astronaut | `POST /api/alerts/{alert_id}/done` | `{ "step": "Drink water" }`: tick a "what to do now" step |
| Astronaut | `POST /api/sim/step` | `{ "scenario": "normal" \| "spike" \| "exercise" \| "loose_watch" \| "low_oxygen", "count": 30 }` |
| Earth | `GET /api/earth` | Received briefs (whatever layers have arrived) and replies. Poll every 1–2 s |
| Earth | `POST /api/earth/reply` | `{ "brief_id": "pb-…", "text": "Rest 15 min, re-measure." }` |
| Simulation | `GET /api/mission` | Mission time, spacecraft distance/light delay, link state, current DSN ground station, BPv7 node counters (`null` in local mode) and the last 40 events, newest first. Poll every 1–2 s |
| Simulation | `GET /api/events?since_id=N` | Events with id > N, oldest first (each has `id`, `ts`, `kind`, `text`, `data`). Poll with the last id you saw |
| Demo | `POST /api/link` | `{ "state": "down" }` cuts the link, `{ "state": "up" }` restores it |
| Demo | `POST /api/link/window` | `{ "budget_bytes": 250 }`: a short contact, only the headline fits |
| Demo | `GET /api/stats` | Bytes sent vs. raw readings, queue counts |
| Demo | `POST /api/reset` | Empty everything for a fresh run |

### `GET /api/spacecraft` (shortened)

```json
{
  "astronaut_id": "crew-01",
  "readings": [{ "ts": "2026-11-14T13:19:26+03:00", "heart_rate": 116.1, "spo2": 98.0,
                 "activity": "rest", "signal_quality": "good", "source": "simulator" }],
  "latest_alert": { "alert_id": "al-489389c411", "severity": "urgent", "metric": "heart_rate",
                    "value": 89.1, "baseline": 72.8,
                    "reason": "Heart rate 89 bpm is 16 bpm above this astronaut's resting normal (73 bpm) while at rest.",
                    "todo": ["Sit down and rest", "Drink water", "Re-measure in 5 minutes"], "done": [] },
  "checkin": { "feeling": "a_bit_off", "symptom": "dizzy" },
  "outbox": [{ "bundle_id": "pb-…:headline", "layer": "headline", "severity": "urgent",
               "size_bytes": 124, "status": "queued" }],
  "link": { "state": "down", "bytes_sent": 0 },
  "eta": { "link_up": false, "earth_sees_in_min": 26, "earliest_reply_in_min": 40 },
  "replies": [{ "text": "Rest 15 min, re-measure.", "author": "Earth medical team" }]
}
```

### `GET /api/earth`: one brief

```json
{ "brief_id": "pb-489389c411",
  "layers": {
    "headline": { "a": "crew-01", "m": "heart_rate", "val": 89.1, "base": 72.8, "sev": "urgent", "sq": "good" },
    "context":  { "reason": "…", "activity": "rest", "spo2": 98.0,
                  "checkin": { "feeling": "a_bit_off", "symptom": "dizzy" }, "done": ["Drink water"], "simulated": true },
    "evidence": { "unit": "bpm", "hr": [[-60, 72], [-59, 73], [0, 89]] } } }
```

Layers arrive one at a time: **always check which keys exist** in `layers`. `evidence.hr` is `[seconds from the event, bpm]`, ready to chart.

## Checklist before pushing (frontend)

**Astronaut dashboard**
- [ ] Live heart rate, oxygen, activity and signal quality from `readings` (last item)
- [ ] Heart-rate trend chart from `readings`
- [ ] Latest alert card: severity colour, `reason`, `todo` steps as checkboxes, ticked ones from `done`
- [ ] 3-tap check-in (fine / a bit off / unwell) + optional symptom
- [ ] "Earth sees this in" and "Earliest reply in" from `eta`
- [ ] Link status badge (up / down)
- [ ] Replies from Earth list
- [ ] Data source selector: synthetic / NASA scenario / wearable (wearable disabled for now)

**Earth console**
- [ ] List of briefs, newest first, severity colour
- [ ] Per brief: which layers arrived (headline / context / evidence)
- [ ] Context: reason, astronaut's check-in, steps done
- [ ] Evidence chart from `evidence.hr`
- [ ] Reply box per brief

**Demo controls** (one small bar is enough)
- [ ] Cut link · Short window · Restore link · Reset
- [ ] Bytes sent vs. raw readings from `/api/stats`

**Before every push**
- [ ] Works against the real backend, not only mocks
- [ ] No console errors; no hard-coded `localhost` outside one config value
- [ ] All text in English (NASA rule); "simulated" label visible on simulated data
- [ ] Installable as a PWA (manifest + icons)
- [ ] Branch from `frontend`, open a pull request, ask Martin to review

## Demo test script (David)

Run in this order on a fresh `POST /api/reset`; tick each one and file an issue for anything broken or confusing.

1. [ ] Simulator **Normal ×60** → no alerts.
2. [ ] **Cut link** → badge shows down, countdown shows ~40 min.
3. [ ] **Heart-rate spike ×30** → a review then an urgent alert; outbox shows 6 queued layers.
4. [ ] Check-in **A bit off**, symptom "dizzy"; tick **Drink water**.
5. [ ] **Short window** → Earth shows headlines only.
6. [ ] **Restore link** → Earth shows all layers, including the check-in and "Drink water".
7. [ ] Earth sends a reply → it appears on the astronaut screen.
8. [ ] **Loose watch ×10** and **Exercise ×10** → no new alerts.
9. [ ] Numbers: bytes sent is far below raw readings.
