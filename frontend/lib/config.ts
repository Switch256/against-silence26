// One place for runtime configuration.
//
// NEXT_PUBLIC_API_URL is the backend origin (default http://127.0.0.1:8001). The browser does not
// call it directly: next.config.ts proxies /backend/* to it, so the page works without CORS.
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8001";
export const API_BASE = "/backend";

/** Polling interval for /api/spacecraft, /api/earth, /api/stats. */
export const POLL_MS = 1000;
/** /api/mission is optional; when it 404s we only retry this often. */
export const MISSION_RETRY_MS = 15000;
