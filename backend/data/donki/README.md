# NASA DONKI snapshot

Real responses from NASA's Space Weather Database Of Notifications, Knowledge, Information
(DONKI, https://api.nasa.gov/ · https://kauai.ccmc.gsfc.nasa.gov/DONKI/), saved on 2026-11-14 so the
demo works offline. File names are `<event type>_<startDate>_<endDate>.json`, exactly as returned by
`https://api.nasa.gov/DONKI/<type>?startDate=...&endDate=...`.

- CME: coronal mass ejections · GST: geomagnetic storms · RBE: radiation belt enhancements
- SEP_2024-05-08_2024-05-20: the solar energetic particle events around the May 2024 G5 storm,
  used by the "replay May 2024" scenario.

With NASA_API_KEY set in backend/.env, POST /api/space-weather/refresh fetches live data instead.
