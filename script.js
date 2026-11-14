// ===== Settings =====
const NORMAL = 72;          // the astronaut's normal pulse
const SMOOTH = 5;           // readings averaged before AEGIS decides

// Incoming messages from Earth: leave "" for demo mode.
// Real project: "/api/messages" must return [{ id: 1, text: "..." }]
const EARTH_API = "";

// Outgoing reports to Earth: leave "" for demo mode.
// Real project: "/api/report" receives a POST with JSON
const REPORT_API = "";

const DEMO_REPLY = true;    // fake Earth reply after the line opens
const OK_SNOOZE = 60000;    // after "I'M OK" HIGH can come back (demo: 60000 | realistic: 300000)

// Readings injected by each circle (simulator)
const SCENARIOS = {
  normal: { hr: 72,  spo2: 98, sleep: 7.1 },
  low:    { hr: 85,  spo2: 98, sleep: 7.1 },
  medium: { hr: 105, spo2: 97, sleep: 5.4 },
  high:   { hr: 130, spo2: 91, sleep: 5.4 }
};

const LABELS = {
  normal: "● NORMAL",
  low:    "● LOW",
  medium: "● MEDIUM",
  high:   "● HIGH"
};

// ===== Reading checks used by the cards (see cards.js) =====
function pulseUp(r)   { return r.hr - NORMAL > 10 && r.spo2 >= 95; }
function pulseDown(r) { return NORMAL - r.hr > 10 && r.spo2 >= 95; }
function oxygenLow(r) { return r.spo2 < 95; }

// ===== Helpers =====
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

// Save and load small things so a page refresh does not lose them
function load(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch (e) { return fallback; }
}
function save(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
}

// Short message at the bottom of the watch
let toastTimer = null;
function toast(text) {
  const t = document.getElementById("toast");
  t.textContent = text;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { t.hidden = true; }, 3000);
}

// Beep and vibration (sound starts only after the first click on the page)
let audioCtx = null;
function beep(times) {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    for (let i = 0; i < times; i++) {
      const o = audioCtx.createOscillator();
      const gn = audioCtx.createGain();
      o.connect(gn);
      gn.connect(audioCtx.destination);
      o.frequency.value = 880;
      gn.gain.value = 0.08;
      const s = audioCtx.currentTime + i * 0.25;
      o.start(s);
      o.stop(s + 0.15);
    }
  } catch (e) {}
  if (navigator.vibrate) navigator.vibrate(times > 1 ? [200, 100, 200] : 200);
}

// ===== State =====
let scenario = "normal";
let bpm = NORMAL;
let t = 0;
let lastKey = "";            // the card list is rebuilt only when this changes
let lastLevel = "normal";    // used to detect when the level changes
let lastR = null;            // latest (smoothed) readings
let lastResult = null;       // latest AEGIS result
let lastCardIds = [];
let okTimer = null;

const chosen = new Set();                    // symptoms chosen in the check-in
const notes = load("aegis_notes", []);       // notes written by the astronaut
const hist = [];                             // last readings for smoothing

// ===== Link status =====
function setLink(on) {
  document.getElementById("link").classList.toggle("on", on);
  document.getElementById("linkText").textContent = on ? "CONNECTED TO EARTH" : "EARTH LINK: STANDBY";
}

function isLinked() {
  const b = document.getElementById("emergency");
  return !b.hidden && b.dataset.state === "connected";
}

// ===== Log (last events) =====
const logItems = load("aegis_log", []);

function renderLog() {
  const box = document.getElementById("logList");
  box.innerHTML = "";
  logItems.slice(0, 4).forEach(function (i) {
    const row = el("p", "log-row");
    row.appendChild(el("span", "log-time", i.time));
    row.appendChild(el("span", "", i.text));
    box.appendChild(row);
  });
  document.getElementById("logBox").hidden = logItems.length === 0;
}

function addLog(text) {
  logItems.unshift({ time: new Date().toLocaleTimeString(), text: text });
  if (logItems.length > 20) logItems.length = 20;
  save("aegis_log", logItems);
  renderLog();
}

// ===== Reports sent UP to Earth =====
// The Earth station (another tab or the right half of the page) listens on "aegis-up"
const upChannel = ("BroadcastChannel" in window) ? new BroadcastChannel("aegis-up") : null;

function buildReport(extra) {
  const r = lastR || { hr: NORMAL, spo2: 98, sleep: 7.1 };
  const rep = {
    type: "report",
    time: new Date().toISOString(),
    crew: "CREW-01",
    hr: r.hr,
    spo2: r.spo2,
    sleep: r.sleep,
    level: lastLevel,
    symptoms: Array.from(chosen),
    cards: lastCardIds,
    notes: notes.slice(-3)
  };
  if (extra) { for (const k in extra) rep[k] = extra[k]; }
  return rep;
}

function sendReport(extra) {
  const rep = buildReport(extra);
  if (upChannel) upChannel.postMessage(rep);
  if (REPORT_API) {
    fetch(REPORT_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rep)
    }).catch(function () {});
  }
}

// Send only while the line to Earth is open
function sendIfLinked() {
  if (isLinked()) sendReport();
}

// ===== Cards =====
// Pick cards from the readings OR from the chosen symptoms
function selectCards(level, r) {
  const list = CARDS.filter(function (c) {
    const byReading = c.when && c.levels && c.levels.indexOf(level) !== -1 && c.when(r);
    const bySymptom = c.symptoms && c.symptoms.some(function (s) { return chosen.has(s); });
    return byReading || bySymptom;
  });
  // Cards supported by real data come first
  list.sort(function (a, b) { return (b.measured ? 1 : 0) - (a.measured ? 1 : 0); });
  return list;
}

// Open or close one card tile (open = big, closed = small)
function setOpen(box, open) {
  box.classList.toggle("open", open);
  box.querySelector(".alert-body").hidden = !open;
  box.querySelector(".chev").classList.toggle("open", open);
}

// Build one small card tile
function buildCard(card, r) {
  const box = el("section", "card alert");

  const head = el("button", "alert-head");
  head.type = "button";

  const top = el("div", "alert-top");
  top.appendChild(el("span", "alert-tag", card.id));
  top.appendChild(el("span", "chev", "▾"));
  head.appendChild(top);

  head.appendChild(el("span", "alert-title", card.title));
  const matches = card.measured && card.when && card.when(r);
  if (matches) head.appendChild(el("span", "alert-badge", "MATCHES DATA"));

  const body = el("div", "alert-body");
  body.hidden = true;                       // start small
  if (matches && card.evidence) {
    body.appendChild(el("p", "evidence", card.evidence(r)));
  } else {
    body.appendChild(el("p", "evidence", "FROM YOUR CHECK-IN · NO SENSOR FOR THIS"));
  }
  body.appendChild(el("p", "alert-label", "POSSIBLE CAUSE"));
  body.appendChild(el("p", "", card.cause));
  body.appendChild(el("p", "alert-label", "WHAT TO DO"));
  const ol = el("ol");
  card.steps.forEach(function (s) { ol.appendChild(el("li", "", s)); });
  body.appendChild(ol);
  body.appendChild(el("p", "note", "SIMULATED GUIDANCE"));

  head.addEventListener("click", function () {
    const willOpen = !box.classList.contains("open");
    // Close every card first, so only one is big at a time
    document.querySelectorAll("#alertList .card.alert").forEach(function (c) {
      setOpen(c, false);
    });
    if (willOpen) {
      setOpen(box, true);
      box.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  });

  box.appendChild(head);
  box.appendChild(body);
  return box;
}

// Show all suggested cards, or hide the list
function showCards(level, r, cards) {
  const wrap = document.getElementById("alertList");
  wrap.innerHTML = "";

  if (cards.length === 0) {
    wrap.hidden = true;
    return;
  }

  wrap.appendChild(el("p", "group-title", "SUGGESTED CARDS · " + cards.length));
  cards.forEach(function (c) { wrap.appendChild(buildCard(c, r)); });

  if (level === "medium") {
    wrap.appendChild(el("p", "group-note", "YOUR READINGS WILL BE CHECKED AGAIN IN 5 MINUTES"));
  }

  wrap.hidden = false;
}

// ===== Messages from Earth =====
const earthMsgs = load("aegis_earth", []);

function drawEarth() {
  const list = document.getElementById("earthList");
  list.innerHTML = "";
  earthMsgs.forEach(function (m, i) {
    const row = el("div", i === 0 && m.fresh ? "msg new" : "msg");
    row.appendChild(el("small", "", "EARTH · " + m.time));
    row.appendChild(el("span", "", m.text));
    list.appendChild(row);
  });
  document.getElementById("earthBox").hidden = earthMsgs.length === 0;
}

function addEarthMessage(text) {
  earthMsgs.forEach(function (m) { m.fresh = false; });
  earthMsgs.unshift({ time: new Date().toLocaleTimeString(), text: text, fresh: true });
  if (earthMsgs.length > 20) earthMsgs.length = 20;
  save("aegis_earth", earthMsgs);
  drawEarth();
  beep(2);
  addLog("EARTH MESSAGE RECEIVED");
  // Tell Earth the message was read
  if (upChannel) upChannel.postMessage({ type: "ack", text: text, time: new Date().toISOString() });
}

// Option A: another tab / the Earth station sends messages (demo)
if ("BroadcastChannel" in window) {
  const channel = new BroadcastChannel("aegis");
  channel.onmessage = function (e) {
    if (e.data && e.data.text) addEarthMessage(e.data.text);
  };
}

// Option B: ask the API every 3 seconds (real project)
let lastMsgId = 0;
function pollEarth() {
  if (!EARTH_API) return;
  fetch(EARTH_API + "?after=" + lastMsgId)
    .then(function (res) { return res.json(); })
    .then(function (list) {
      list.forEach(function (m) {
        lastMsgId = Math.max(lastMsgId, m.id || 0);
        addEarthMessage(m.text);
      });
    })
    .catch(function () { /* ignore, try again next time */ });
}

// ===== HIGH level: countdown, accept / refuse, contact Earth =====
const EM_SECONDS = 10;        // time the astronaut has to answer
const REFUSE_SECONDS = 30;    // wait after a refusal before Earth is contacted anyway
                              // demo: 30 | realistic: 300 (5 minutes)
const CONNECT_DELAY = 3000;   // how long "contacting Earth" lasts (ms)

let emInterval = null;
let emTimeout = null;
let emLeft = EM_SECONDS;
let emTotal = EM_SECONDS;     // length of the countdown that is running now

// Stop every running timer of the emergency flow
function emClear() {
  clearInterval(emInterval);
  clearTimeout(emTimeout);
  emInterval = null;
  emTimeout = null;
}

// Switch the emergency card to a state and update what is visible
// states: counting, declined, connecting, connected
function emSet(state, title, text) {
  const box = document.getElementById("emergency");
  const counting = state === "counting";
  const declined = state === "declined";

  box.dataset.state = state;
  document.getElementById("emTitle").textContent = title;
  document.getElementById("emText").textContent = text;

  // The number and the bar show in both "counting" and "declined"
  document.getElementById("emCount").hidden = !(counting || declined);
  document.getElementById("emBar").hidden = !(counting || declined);
  document.getElementById("emHint").hidden = !(counting || declined);
  document.getElementById("emHint").textContent = declined
    ? "IF YOUR READINGS STAY HIGH, EARTH WILL BE CONTACTED WHEN THE TIMER ENDS"
    : "EARTH WILL BE CONTACTED AUTOMATICALLY WHEN THE TIMER ENDS";

  // Accept shows in both; Refuse shows only in the first countdown
  const accept = document.getElementById("btnAccept");
  accept.textContent = declined ? "CONTACT EARTH NOW" : "ACCEPT";
  accept.hidden = !(counting || declined);
  document.getElementById("btnRefuse").hidden = !counting;
  document.getElementById("emButtons").hidden = !(counting || declined);

  setLink(state === "connected");
  box.hidden = false;
}

// Update the number and the bar
function emUpdateCount() {
  document.getElementById("emCount").textContent = emLeft;
  document.getElementById("emFill").style.width = (emLeft / emTotal * 100) + "%";
}

// Run a countdown; when it ends, Earth is contacted
function runCountdown(seconds) {
  emClear();
  emTotal = seconds;
  emLeft = seconds;
  emUpdateCount();

  emInterval = setInterval(function () {
    emLeft -= 1;
    emUpdateCount();
    if (emLeft <= 0) {
      connectEarth();
    }
  }, 1000);
}

// Open the line to Earth
function connectEarth() {
  emClear();
  emSet("connecting", "CONTACTING EARTH", "OPENING A SECURE LINK...");
  emTimeout = setTimeout(function () {
    emSet("connected", "EARTH LINE OPEN", "MEDICAL TEAM IS RECEIVING YOUR PULSE AND OXYGEN DATA");
    addLog("EARTH LINE OPEN");
    sendReport();
    // Demo reply from Earth (only when no real API is set)
    if (DEMO_REPLY && !EARTH_API) {
      setTimeout(function () {
        addEarthMessage("WE RECEIVED YOUR DATA. SIT DOWN AND BREATHE SLOWLY. A DOCTOR IS JOINING.");
      }, 4000);
    }
  }, CONNECT_DELAY);
}

// The astronaut refused: wait, then contact Earth anyway if still HIGH
// (if the level drops, stopEmergency() cancels this countdown)
function declineEarth() {
  emSet("declined", "CONTACT DECLINED", "AEGIS KEEPS MONITORING YOUR READINGS.");
  addLog("CONTACT DECLINED");
  runCountdown(REFUSE_SECONDS);
}

// Start the 10 second countdown when the level becomes HIGH
function startEmergency(reason) {
  emSet("counting", "HIGH ALERT", reason);
  runCountdown(EM_SECONDS);
  beep(3);
}

// Hide everything when the level is no longer HIGH
function stopEmergency() {
  emClear();
  document.getElementById("emergency").hidden = true;
  setLink(false);
}

document.getElementById("btnAccept").addEventListener("click", connectEarth);
document.getElementById("btnRefuse").addEventListener("click", declineEarth);

// ===== "I'M OK" button =====
// Cancels the alert and tells Earth. If the level is still HIGH, the alert can come back later.
document.getElementById("btnOk").addEventListener("click", function () {
  const wasHigh = lastLevel === "high";
  sendReport({ ok: true });
  stopEmergency();
  addLog("ASTRONAUT: I'M OK");
  toast("OK SENT TO EARTH");
  clearTimeout(okTimer);
  if (wasHigh) {
    okTimer = setTimeout(function () {
      if (lastLevel === "high") startEmergency(lastResult.reason);
    }, OK_SNOOZE);
  }
});

// ===== Simulator =====
async function getReading() {
  t += 1;
  const s = SCENARIOS[scenario];
  const hr = Math.round(s.hr + Math.sin(t / 9) * 2.5 + (Math.random() - 0.5) * 3);
  // Oxygen drifts by about +/-1 so it looks like a real sensor
  const spo2 = Math.round(s.spo2 + (Math.random() - 0.5) * 1.6);
  return { hr: hr, spo2: spo2, sleep: s.sleep };
}

// ===== AEGIS: compares readings to normal, returns level and reason =====
function aegis(r) {
  const diff = r.hr - NORMAL;
  const abs = Math.abs(diff);
  const dir = diff > 0 ? "ABOVE" : "BELOW";

  let level = "normal";
  let reason = "ALL READINGS WITHIN YOUR NORMAL";

  if (abs > 40 || r.spo2 < 92) {
    level = "high";
  } else if (abs > 20 || r.spo2 < 95) {
    level = "medium";
  } else if (abs > 10) {
    level = "low";
  }

  if (level !== "normal") {
    if (r.spo2 < 95 && abs <= 20) {
      reason = "OXYGEN " + r.spo2 + "% IS BELOW SAFE RANGE";
    } else {
      reason = "PULSE " + r.hr + " IS " + abs + " " + dir + " YOUR NORMAL";
      if (r.spo2 < 95) reason += " · OXYGEN " + r.spo2 + "%";
    }
  }

  return { level: level, reason: reason };
}

// ===== ECG drawing =====
function g(x, c, w) {
  return Math.exp(-((x - c) * (x - c)) / (2 * w * w));
}

function beat(p) {
  return 0.12 * g(p, 0.16, 0.035)
       - 0.10 * g(p, 0.295, 0.011)
       + 1.00 * g(p, 0.32, 0.011)
       - 0.22 * g(p, 0.345, 0.012)
       + 0.30 * g(p, 0.56, 0.055);
}

const N = 300;
const RATE = 50;
const wave = new Array(N).fill(0);
let phase = 0;
let jitter = 1;

function step() {
  phase += (bpm / 60 / RATE) * jitter;
  if (phase >= 1) {
    phase -= 1;
    jitter = 1 + (Math.random() - 0.5) * 0.06;
  }
  wave.shift();
  wave.push(beat(phase) + (Math.random() - 0.5) * 0.02);

  const pts = wave.map(function (v, i) {
    return i + "," + (48 - v * 38).toFixed(1);
  });
  document.getElementById("trace").setAttribute("points", pts.join(" "));
  document.getElementById("tip").setAttribute("cy", (48 - wave[N - 1] * 38).toFixed(1));
}

// ===== UI update =====
function render(r, result) {
  lastR = r;
  lastResult = result;
  bpm = r.hr;
  document.getElementById("hr").textContent = r.hr;
  document.getElementById("spo2").textContent = r.spo2;
  document.getElementById("sleep").textContent = r.sleep;
  document.getElementById("status").textContent = LABELS[result.level];
  document.getElementById("reason").textContent = result.reason;
  document.getElementById("btnOk").hidden = result.level === "normal";
  document.body.dataset.level = result.level;

  // Start or stop the HIGH flow only when the level changes
  if (result.level !== lastLevel) {
    lastLevel = result.level;
    clearTimeout(okTimer);
    addLog("LEVEL: " + result.level.toUpperCase());
    if (result.level === "high") {
      startEmergency(result.reason);
    } else {
      stopEmergency();
    }
  }

  // Rebuild the card list only when the set of matching cards changes,
  // so an opened card is not closed every second
  const cards = selectCards(result.level, r);
  const ids = cards.map(function (c) { return c.id; }).join(",");
  lastCardIds = cards.map(function (c) { return c.id; });
  const key = result.level + ":" + ids;
  if (key !== lastKey) {
    lastKey = key;
    showCards(result.level, r, cards);
    sendIfLinked();   // Earth sees the new suggested cards
  }
}

// Average of the last readings, so numbers do not jump every second
async function tick() {
  const raw = await getReading();
  hist.push(raw);
  if (hist.length > SMOOTH) hist.shift();

  const avg = function (key) {
    return hist.reduce(function (sum, x) { return sum + x[key]; }, 0) / hist.length;
  };
  const r = { hr: Math.round(avg("hr")), spo2: Math.round(avg("spo2")), sleep: raw.sleep };
  render(r, aegis(r));
}

// ===== Level circles =====
const dots = document.querySelectorAll("#levels .lvl");
dots.forEach(function (btn) {
  btn.addEventListener("click", function () {
    dots.forEach(function (d) { d.classList.remove("active"); });
    btn.classList.add("active");
    scenario = btn.dataset.level;
    hist.length = 0;   // forget old readings so the change is immediate
    tick();
  });
});

// ===== Check-in: grouped symptom chips =====
const GROUPS = [
  ["HEAD",           ["dizzy", "nausea", "headache"]],
  ["BODY",           ["thirst", "tired", "backpain", "jointpain", "swelling"]],
  ["HEART & BREATH", ["breath", "palpitations"]],
  ["OTHER",          ["stress", "rash", "pain", "radiation"]]
];

const symptomLabel = {};
SYMPTOMS.forEach(function (s) { symptomLabel[s[0]] = s[1]; });

const groupsBox = document.getElementById("groups");
const groupEls = [];

function updateCounts() {
  groupEls.forEach(function (g) {
    const n = g.keys.filter(function (k) { return chosen.has(k); }).length;
    g.cnt.textContent = n ? "● " + n : "";
  });
}

GROUPS.forEach(function (grp, i) {
  const d = el("details", "grp");
  if (i === 0) d.open = true;

  const sm = el("summary", "", grp[0]);
  const cnt = el("span", "cnt", "");
  sm.appendChild(cnt);
  d.appendChild(sm);

  const chips = el("div", "chips");
  grp[1].forEach(function (key) {
    const b = el("button", "chip", symptomLabel[key]);
    b.type = "button";
    b.addEventListener("click", function () {
      if (chosen.has(key)) chosen.delete(key); else chosen.add(key);
      b.classList.toggle("on");
      updateCounts();
      if (lastR) render(lastR, lastResult);   // refresh cards without a new reading
      sendIfLinked();                         // Earth sees the symptoms
    });
    chips.appendChild(b);
  });
  d.appendChild(chips);
  groupsBox.appendChild(d);
  groupEls.push({ keys: grp[1], cnt: cnt });
});

// ===== Free note =====
const noteText = document.getElementById("noteText");

noteText.addEventListener("input", function () {
  document.getElementById("noteCount").textContent = noteText.value.length + " / 300";
});

document.getElementById("btnNote").addEventListener("click", function () {
  const text = noteText.value.trim();
  if (!text) return;

  // Save the note together with the readings at that moment
  notes.push({
    text: text,
    time: new Date().toLocaleTimeString(),
    hr: document.getElementById("hr").textContent,
    spo2: document.getElementById("spo2").textContent
  });
  save("aegis_notes", notes);

  const linked = isLinked();
  const status = document.getElementById("noteStatus");
  status.textContent = linked ? "NOTE SENT TO EARTH · DELIVERED" : "NOTE SAVED · SENT WITH YOUR NEXT REPORT";
  status.hidden = false;
  if (linked) sendReport();
  addLog(linked ? "NOTE SENT" : "NOTE SAVED");

  noteText.value = "";
  document.getElementById("noteCount").textContent = "0 / 300";
  setTimeout(function () { status.hidden = true; }, 3000);
});

// ===== Start =====
renderLog();
drawEarth();
tick();
setInterval(tick, 1000);
setInterval(step, 1000 / RATE);
setInterval(pollEarth, 3000);
setInterval(sendIfLinked, 5000);   // while the line is open, Earth gets fresh data every 5 s