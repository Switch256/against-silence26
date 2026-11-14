// ===== Settings =====
const NORMAL = 72;          // the astronaut's normal pulse

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

// ===== Reading checks used by the cards =====
function pulseUp(r)   { return r.hr - NORMAL > 10 && r.spo2 >= 95; }
function pulseDown(r) { return NORMAL - r.hr > 10 && r.spo2 >= 95; }
function oxygenLow(r) { return r.spo2 < 95; }

// ===== Problem cards =====
// levels   = the levels where the card can be shown
// when     = the card is shown only if this returns true for the current readings
// measured = true when a real sensor reading supports the card
// evidence = optional text built from the readings
// General wellness guidance for a simulation, not medical advice.
const CARDS = [
  {
    id: 1, levels: ["low", "medium"], measured: false,
    when: pulseUp,
    title: "AFTER EXERCISE",
    cause: "Pulse stays high for a while after a workout.",
    steps: ["Rest for 5 to 10 minutes.", "Drink water.", "Stay calm and breathe slowly."]
  },
  {
    id: 2, levels: ["low"], measured: false,
    when: pulseUp,
    title: "STRESS",
    cause: "Mission pressure or a system fault raises pulse.",
    steps: ["Breathe slowly: 4 seconds in, 6 seconds out.", "Pause the task if it is safe.", "Tell the crew or Earth if it continues."]
  },
  {
    id: 3, levels: ["low", "medium"], measured: false,
    when: pulseUp,
    title: "DEHYDRATION",
    cause: "Low fluid makes the heart beat faster.",
    steps: ["Drink water now.", "Log your fluid intake today.", "Avoid caffeine for a few hours."]
  },
  {
    id: 4, levels: ["low", "medium"], measured: true,
    when: function (r) { return pulseUp(r) && r.sleep < 6; },
    evidence: function (r) { return "YOUR SLEEP: " + r.sleep + " HRS (UNDER 6)"; },
    title: "POOR SLEEP",
    cause: "Short or broken sleep raises resting pulse.",
    steps: ["Avoid caffeine for the next few hours.", "Take a short rest if your schedule allows.", "Report if you slept under 5 hours for several days."]
  },
  {
    id: 5, levels: ["low", "medium"], measured: false,
    when: pulseUp,
    title: "SPACE MOTION SICKNESS",
    cause: "Nausea and dizziness in the first days of microgravity.",
    steps: ["Keep your head still and avoid sudden movements.", "Focus on a fixed point.", "Contact Earth if vomiting continues."]
  },
  {
    id: 6, levels: ["medium"], measured: false,
    when: pulseUp,
    title: "EARLY FEVER",
    cause: "A rising temperature can speed up the heart before symptoms appear.",
    steps: ["Take your temperature if a thermometer is available.", "Drink water and rest.", "Report to Earth if temperature is above 38 C."]
  },
  {
    id: 7, levels: ["low", "medium"], measured: false,
    when: oxygenLow,
    title: "LOOSE SENSOR",
    cause: "A badly placed sensor can show a lower oxygen value than the real one.",
    steps: ["Re-seat the sensor on a clean, warm finger.", "Stay still for 30 seconds.", "Compare with a second reading."]
  },
  {
    id: 8, levels: ["medium"], measured: false,
    when: oxygenLow,
    title: "HIGH CO2 IN CABIN",
    cause: "CO2 can build up in a poorly ventilated module. Headache and drowsiness often come with it.",
    steps: ["Move to a well ventilated module.", "Check the cabin CO2 reading.", "Report to Earth if the headache continues."]
  },
  {
    id: 9, levels: ["medium"], measured: false,
    when: oxygenLow,
    title: "AIRWAY IRRITATION",
    cause: "Dust or dry air can irritate the airways and cause coughing.",
    steps: ["Drink water and breathe slowly.", "Check the air filters.", "Report if coughing or breathing difficulty continues."]
  },
  {
    id: 10, levels: ["low", "medium"], measured: false,
    when: pulseDown,
    title: "RESTING STATE",
    cause: "Pulse drops during deep rest or relaxation.",
    steps: ["Stand up and move slowly.", "Notice if you feel dizzy or faint.", "Report if dizziness continues."]
  },
  {
    id: 11, levels: ["low", "medium"], measured: false,
    when: pulseDown,
    title: "COLD OR INACTIVITY",
    cause: "A cold module or a long time without movement can slow the pulse.",
    steps: ["Warm up and add a layer.", "Do light movement for a few minutes.", "Check your pulse again after warming up."]
  }
];

// Small helper to create an element with a class and text
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

// Pick the cards that match the level AND the real readings
function selectCards(level, r) {
  if (level !== "low" && level !== "medium") return [];
  const list = CARDS.filter(function (c) {
    return c.levels.indexOf(level) !== -1 && c.when(r);
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
  top.appendChild(el("span", "alert-tag", "#" + card.id));
  top.appendChild(el("span", "chev", "▾"));
  head.appendChild(top);

  head.appendChild(el("span", "alert-title", card.title));
  if (card.measured) head.appendChild(el("span", "alert-badge", "MATCHES DATA"));

  const body = el("div", "alert-body");
  body.hidden = true;                       // start small
  if (card.measured && card.evidence) {
    body.appendChild(el("p", "evidence", card.evidence(r)));
  } else {
    body.appendChild(el("p", "evidence", "NO SENSOR FOR THIS · BASED ON YOUR READINGS ONLY"));
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

// Show all matching cards side by side, or hide the list
function showCards(level, r, cards) {
  const wrap = document.getElementById("alertList");
  wrap.innerHTML = "";

  if (cards.length === 0) {
    wrap.hidden = true;
    return;
  }

  let title = "POSSIBLE CAUSES OF LOW PULSE";
  if (r.spo2 < 95) title = "POSSIBLE CAUSES OF LOW OXYGEN";
  else if (r.hr > NORMAL) title = "POSSIBLE CAUSES OF HIGH PULSE";

  wrap.appendChild(el("p", "group-title", title + " · " + cards.length));
  cards.forEach(function (c) { wrap.appendChild(buildCard(c, r)); });

  if (level === "medium") {
    wrap.appendChild(el("p", "group-note", "YOUR READINGS WILL BE CHECKED AGAIN IN 5 MINUTES"));
  }

  wrap.hidden = false;
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
  }, CONNECT_DELAY);
}

// The astronaut refused: wait, then contact Earth anyway if still HIGH
// (if the level drops, stopEmergency() cancels this countdown)
function declineEarth() {
  emSet("declined", "CONTACT DECLINED", "AEGIS KEEPS MONITORING YOUR READINGS.");
  runCountdown(REFUSE_SECONDS);
}

// Start the 10 second countdown when the level becomes HIGH
function startEmergency(reason) {
  emSet("counting", "HIGH ALERT", reason);
  runCountdown(EM_SECONDS);
}

// Hide everything when the level is no longer HIGH
function stopEmergency() {
  emClear();
  document.getElementById("emergency").hidden = true;
}

document.getElementById("btnAccept").addEventListener("click", connectEarth);
document.getElementById("btnRefuse").addEventListener("click", declineEarth);

let scenario = "normal";
let bpm = NORMAL;
let t = 0;
let lastKey = "";            // the card list is rebuilt only when this changes
let lastLevel = "normal";    // used to detect when the level changes

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
  bpm = r.hr;
  document.getElementById("hr").textContent = r.hr;
  document.getElementById("spo2").textContent = r.spo2;
  document.getElementById("sleep").textContent = r.sleep;
  document.getElementById("status").textContent = LABELS[result.level];
  document.getElementById("reason").textContent = result.reason;
  document.body.dataset.level = result.level;

  // Start or stop the HIGH flow only when the level changes
  if (result.level !== lastLevel) {
    lastLevel = result.level;
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
  const key = result.level + ":" + ids;
  if (key !== lastKey) {
    lastKey = key;
    showCards(result.level, r, cards);
  }
}

async function tick() {
  const r = await getReading();
  render(r, aegis(r));
}

// ===== Level circles =====
const dots = document.querySelectorAll("#levels .lvl");
dots.forEach(function (btn) {
  btn.addEventListener("click", function () {
    dots.forEach(function (d) { d.classList.remove("active"); });
    btn.classList.add("active");
    scenario = btn.dataset.level;
    tick();   // update immediately instead of waiting for the next second
  });
});

// ===== Start =====
tick();
setInterval(tick, 1000);
setInterval(step, 1000 / RATE);