import type { EarthState, MissionState, SpaceWeather, SpacecraftState, Stats } from "./api";

const now = new Date().toISOString();
const alert = {
  alert_id: "demo-alert-01", ts: now, severity: "urgent" as const, metric: "heart_rate",
  value: 110, baseline: 72, reason: "Heart rate is above this astronaut's resting normal while at rest.",
  todo: ["Sit down and rest", "Drink water", "Re-measure in 5 minutes"], done: [],
};

export const demoSpacecraft: SpacecraftState = {
  astronaut_id: "crew-01", readings: [{ ts: now, heart_rate: 110, spo2: 98, activity: "rest", signal_quality: "good", source: "simulated" }],
  latest_alert: alert, alerts: [alert], checkin: { feeling: "a_bit_off", symptom: "dizzy" },
  outbox: ["headline", "context", "evidence"].map((layer, i) => ({ bundle_id: `demo-${layer}`, brief_id: "demo-brief-01", layer: layer as "headline" | "context" | "evidence", severity: "urgent" as const, size_bytes: [124, 420, 1860][i], status: "queued" as const })),
  link: { state: "down", bytes_sent: 0 }, eta: { link_up: false, earth_sees_in_min: 14, earliest_reply_in_min: 40 }, replies: [], transport: "demo",
};

export const demoEarth: EarthState = { briefs: [], replies: [] };
export const demoStats: Stats = { queued: 3, in_transit: 0, delivered: 0, briefs: 1, bytes_sent: 0, readings: 1, transport: "demo", raw_bytes_equivalent: 18000 };
export const demoMission: MissionState = { mission_time_s: 1260, spacecraft: { name: "AEGIS-01", distance_km: 2240000, light_delay_s: 840, phase: "contact lost" }, link: { state: "down" }, ground_station: { name: "goldstone", lat: 35.4, lon: -116.9 }, bpv7: null, events: [{ ts: now, kind: "demo", text: "Demo data · no login or backend required" }] };

// Real NASA DONKI records (May 2024 solar particle events, from backend/data/donki) so the offline
// showcase still shows the NASA data source.
const SEP_EVENTS = [
  {
    "event_id": "2024-05-09T13:59:00-SEP-001",
    "kind": "SEP",
    "start_time": "2024-05-09T13:59:00Z",
    "severity": "warning",
    "summary": "Solar energetic particle event (MODEL: REleASE:ACE/EPAM 15.8-39.8 MeV)",
    "link": "https://ccmc.gsfc.nasa.gov/DONKI/view/SEP/30609/-1",
    "origin": "snapshot"
  },
  {
    "event_id": "2024-05-09T14:25:00-SEP-001",
    "kind": "SEP",
    "start_time": "2024-05-09T14:25:00Z",
    "severity": "warning",
    "summary": "Solar energetic particle event (MODEL: REleASE:SOHO/EPHIN 15.8-39.8 MeV)",
    "link": "https://ccmc.gsfc.nasa.gov/DONKI/view/SEP/30610/-1",
    "origin": "snapshot"
  }
];
export const demoSpaceWeather: SpaceWeather = {
  level: "warning", headline: "Solar particle event in progress: radiation risk elevated", active: SEP_EVENTS, recent: SEP_EVENTS,
  todo: ["Move to the most shielded module", "Keep your personal dosimeter on", "Postpone any EVA"],
  source: "NASA DONKI", note: "Environmental conditions, not a measured crew dose.", mode: "replay", as_of: "2024-05-09T14:30:00Z",
};
