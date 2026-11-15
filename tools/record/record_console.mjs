// Records the live console for the demo video and slides (needs the backend on :8001 and the frontend on :3001).
//
//   GPU=1 node tools/record/record_console.mjs <outdir> cut   frames of Cut link -> on-board alert -> restore (about 8 fps)
//   GPU=1 node tools/record/record_console.mjs <outdir> sep   one frame of the real May 2024 NASA DONKI replay
//
// Writes <outdir>/NNNN.jpg and <outdir>/frames.json [{file, t, phase}] for tools/blender/demo_video.py --rec.
// It resets the backend first. GPU=1 renders with the Mac's GPU; without it, software rendering (slow, ~0.2 fps).
import { spawn } from "node:child_process";
import { writeFileSync, mkdtempSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const [out, mode = "cut"] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const port = 9300 + Math.floor(Math.random() * 500);
const prof = mkdtempSync(join(tmpdir(), "aegis-rec-"));
const W = 1920, H = 1080;
const chrome = spawn(process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", [...(process.env.GPU ? ["--headless=new", "--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] : ["--headless=new", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]), `--window-size=${W},${H}`, "--hide-scrollbars", `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`, "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let targets; for (let i = 0; i < 50; i++) { try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); break; } catch { await sleep(200); } }
const ws = new WebSocket(targets.find((t) => t.type === "page").webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r));
let id = 0; const pending = new Map();
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
ws.addEventListener("message", (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result ?? m.error); pending.delete(m.id); return; }
  if (m.method === "Runtime.exceptionThrown") console.log("[exception]", JSON.stringify(m.params.exceptionDetails).slice(0, 600));
});
const B = process.env.API ?? "http://127.0.0.1:8001";
const post = async (p, body = {}) => (await fetch(B + p, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })).status;
const click = async (label) => (await send("Runtime.evaluate", { expression: `(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(label)}); b?.click(); return !!b})()`, returnByValue: true })).result.value;
await send("Runtime.enable"); await send("Page.enable");
await send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: 1, mobile: false });

const frames = []; let n = 0; let phase = "nominal"; let t0 = 0;
const grab = async () => {
  const r = await send("Page.captureScreenshot", { format: "jpeg", quality: 90 });
  const file = `${String(n++).padStart(4, "0")}.jpg`;
  writeFileSync(`${out}/${file}`, Buffer.from(r.data, "base64"));
  frames.push({ file, t: (Date.now() - t0) / 1000, phase });
};
const record = async (ms) => { const end = Date.now() + ms; while (Date.now() < end) await grab(); };

await post("/api/reset"); await post("/api/link", { state: "up" }); await post("/api/space-weather/replay", { scenario: "live" });
await sleep(1500);
await send("Page.navigate", { url: process.env.URL ?? "http://localhost:3001/demo" });
await sleep(25000);
await post("/api/sim/step", { scenario: "normal", count: 60 });
await sleep(5000);

if (mode === "sep") {
  await post("/api/space-weather/replay", { scenario: "may-2024" });
  await sleep(8000); t0 = Date.now(); phase = "sep"; await grab();
} else {
  t0 = Date.now();
  await record(2500);
  phase = "cut"; console.log("cut:", await click("Cut link"));
  await record(2500);
  phase = "alert"; await post("/api/sim/step", { scenario: "spike", count: 30, force: true });
  await record(5000);
  phase = "restore"; console.log("restore:", await click("Restore link"));
  await record(9000);
}
writeFileSync(`${out}/frames.json`, JSON.stringify(frames, null, 1));
console.log(`${frames.length} frames, ${frames.at(-1)?.t.toFixed(1)} s`);
ws.close(); chrome.kill(); process.exit(0);
