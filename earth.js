// Earth station: simulated patient file and pre-flight tests
(function () {

  const PATIENT = {
    id: "CREW-01",
    age: "34 · M",
    body: "178 CM · 74 KG",
    blood: "O+",
    allergy: "PENICILLIN",
    chronic: "MILD ASTHMA (CONTROLLED)",
    meds: "INHALER, AS NEEDED",
    baseline: { pulse: 72, spo2: 98, sleep: 7.1 }
  };

  // [name, result, date, flag]  (flag true = worth a doctor's attention)
  const GROUPS = [
    {
      title: "HEAD",
      tests: [
        ["VISION",        "20/20 · NORMAL",                          "2026-03"],
        ["HEARING",       "FULL RANGE · NORMAL",                     "2026-03"],
        ["NEUROLOGICAL",  "NORMAL EXAM",                             "2026-02"],
        ["BALANCE",       "INNER EAR NORMAL · LOW MOTION SICKNESS",  "2026-03"],
        ["PSYCHOLOGICAL", "STABLE · GOOD STRESS TOLERANCE",          "2026-01"]
      ]
    },
    {
      title: "BODY",
      tests: [
        ["BLOOD & URINE",    "ALL VALUES IN RANGE",    "2026-03"],
        ["BONE DENSITY",     "DEXA NORMAL",            "2026-02"],
        ["MUSCLE STRENGTH",  "ABOVE AVERAGE",          "2026-03"],
        ["BODY COMPOSITION", "BMI 23.4 · FAT 14%",     "2026-03"]
      ]
    },
    {
      title: "HEART & BREATH",
      tests: [
        ["ECG AT REST",    "NORMAL SINUS RHYTHM",             "2026-03"],
        ["STRESS TEST",    "PASSED · NO ABNORMALITY",         "2026-03"],
        ["BLOOD PRESSURE", "118 / 76",                        "2026-03"],
        ["SPIROMETRY",     "96% OF PREDICTED · MILD ASTHMA",  "2026-03", true],
        ["VO2 MAX",        "52 ML/KG/MIN",                    "2026-03"]
      ]
    },
    {
      title: "OTHER",
      tests: [
        ["ALLERGY",     "PENICILLIN",                "2025-11", true],
        ["MEDICATION",  "INHALER, AS NEEDED",        "2026-03", true],
        ["G-FORCE",     "PASSED UP TO 6 G",          "2026-04"],
        ["VACCINES",    "UP TO DATE",                "2026-02"],
        ["QUARANTINE",  "COMPLETED · NO ISSUES",     "2026-10"]
      ]
    }
  ];

  function mk(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  // ----- State: opened results, newest first -----
  const opened = [];          // keys like "0:3"
  const chipByKey = {};       // key -> chip button
  const cntByGroup = [];      // group index -> counter element

  // ----- Thin patient file: small chips on two lines -----
  function drawSummary() {
    const box = document.getElementById("esSummary");
    box.innerHTML = "";

    // Line 1: label and basic identity
    const line1 = mk("div", "es-line");
    line1.appendChild(mk("span", "es-label", "PATIENT FILE"));
    [PATIENT.id, PATIENT.age, PATIENT.body, PATIENT.blood].forEach(function (text) {
      line1.appendChild(mk("span", "es-chip", text));
    });
    box.appendChild(line1);

    // Line 2: allergy and chronic condition stand out, medication is normal
    const line2 = mk("div", "es-line");
    line2.appendChild(mk("span", "es-chip crit", "ALLERGY: " + PATIENT.allergy));
    line2.appendChild(mk("span", "es-chip crit", PATIENT.chronic));
    line2.appendChild(mk("span", "es-chip", PATIENT.meds));
    box.appendChild(line2);

    // Baseline readings
    const b = PATIENT.baseline;
    const base = mk("p", "es-base");
    base.innerHTML = "BASELINE ON EARTH · PULSE <b>" + b.pulse + " BPM</b> · OXYGEN <b>" +
                     b.spo2 + "%</b> · SLEEP <b>" + b.sleep + " HRS</b>";
    box.appendChild(base);
  }

  // ----- Results column (left, under the messages) -----
  const results = mk("div", "es-results");

  function updateCounts() {
    GROUPS.forEach(function (g, gi) {
      const n = opened.filter(function (k) { return k.split(":")[0] === String(gi); }).length;
      cntByGroup[gi].textContent = n ? "● " + n : "";
    });
  }

  function toggle(key) {
    const at = opened.indexOf(key);
    if (at !== -1) {
      opened.splice(at, 1);
    } else {
      opened.unshift(key);
    }
    chipByKey[key].classList.toggle("on", opened.indexOf(key) !== -1);
    updateCounts();
    drawResults();
  }

  function drawResults() {
    results.innerHTML = "";

    const head = mk("div", "es-results-head");
    head.appendChild(mk("span", "", "RESULTS · " + opened.length));
    if (opened.length) {
      const clear = mk("button", "es-clear", "CLEAR");
      clear.type = "button";
      clear.addEventListener("click", function () {
        opened.slice().forEach(function (k) { chipByKey[k].classList.remove("on"); });
        opened.length = 0;
        updateCounts();
        drawResults();
      });
      head.appendChild(clear);
    }
    results.appendChild(head);

    if (opened.length === 0) {
      results.appendChild(mk("p", "es-empty", "PRESS A TEST ON THE RIGHT TO SEE ITS RESULT HERE"));
      return;
    }

    opened.forEach(function (key) {
      const parts = key.split(":");
      const g = GROUPS[Number(parts[0])];
      const t = g.tests[Number(parts[1])];

      const tile = mk("section", t[3] ? "card es-tile flag" : "card es-tile");

      const top = mk("div", "es-tile-top");
      top.appendChild(mk("span", "es-tag", g.title));
      const x = mk("button", "es-x", "×");
      x.type = "button";
      x.title = "Close";
      x.addEventListener("click", function () { toggle(key); });
      top.appendChild(x);

      tile.appendChild(top);
      tile.appendChild(mk("p", "es-tile-name", t[0]));
      tile.appendChild(mk("p", "es-tile-res", t[1]));
      tile.appendChild(mk("p", "es-tile-date", t[2]));
      results.appendChild(tile);
    });
  }

  // ----- Tests list (right) -----
  function buildTests() {
    const card = mk("section", "card es-tests");

    const total = GROUPS.reduce(function (s, g) { return s + g.tests.length; }, 0);
    const h = mk("h2", "", "TESTS");
    h.appendChild(mk("span", "es-count", total + " TOTAL"));
    card.appendChild(h);

    GROUPS.forEach(function (g, gi) {
      const d = mk("details", "grp");
      if (gi === 0) d.open = true;

      const sm = mk("summary", "", g.title);
      const cnt = mk("span", "cnt", "");
      sm.appendChild(cnt);
      d.appendChild(sm);
      cntByGroup[gi] = cnt;

      const chips = mk("div", "chips");
      g.tests.forEach(function (t, ti) {
        const key = gi + ":" + ti;
        const b = mk("button", t[3] ? "chip flag" : "chip", t[0]);
        b.type = "button";
        b.addEventListener("click", function () { toggle(key); });
        chips.appendChild(b);
        chipByKey[key] = b;
      });
      d.appendChild(chips);
      card.appendChild(d);
    });

    return card;
  }

  // ===== Event log: a timeline of what happens on the astronaut's watch =====
  // Everything is detected from the watch page itself (no changes to script.js):
  //  - level changes      -> body[data-level]
  //  - problem cards read -> clicks on #alertList .alert-head
  //  - symptoms reported  -> clicks on #groups .chip
  //  - contact with Earth -> #emergency[data-state] and its buttons

  const LEVEL_COLORS = {
    normal: "#4ade80",
    low:    "#facc15",
    medium: "#fb923c",
    high:   "#ef4444"
  };
  const ACTION_COLOR = "#e9d5ff";   // things the astronaut pressed
  const EARTH_COLOR  = "#a855f7";   // contact with Earth

  const MAX_EVENTS = 60;
  const events = [];                // newest first
  let logList = null;
  let logTitle = null;
  let logNow = null;

  // Current time as HH:MM:SS
  function clock() {
    return new Date().toLocaleTimeString("en-GB");
  }

  // 65 seconds -> "1M 05S"
  function span(ms) {
    const s = Math.round(ms / 1000);
    const m = Math.floor(s / 60);
    const r = s % 60;
    return m > 0 ? m + "M " + (r < 10 ? "0" : "") + r + "S" : r + "S";
  }

  function shorten(text, max) {
    return text.length > max ? text.slice(0, max) + "..." : text;
  }

  function addEvent(text, color) {
    events.unshift({ time: clock(), text: text, color: color || ACTION_COLOR });
    if (events.length > MAX_EVENTS) events.pop();
    drawLog();
  }

  function drawLog() {
    if (!logList) return;
    logList.innerHTML = "";
    logTitle.textContent = "EVENT LOG · " + events.length;

    if (events.length === 0) {
      logList.appendChild(mk("p", "el-empty", "NO EVENTS YET"));
      return;
    }

    events.forEach(function (ev) {
      const row = mk("div", "el-row");
      row.style.borderLeftColor = ev.color;

      row.appendChild(mk("span", "el-time", ev.time));
      const dot = mk("span", "el-dot");
      dot.style.background = ev.color;
      dot.style.boxShadow = "0 0 6px " + ev.color;
      row.appendChild(dot);
      row.appendChild(mk("span", "el-text", ev.text));

      logList.appendChild(row);
    });
  }

  // The small "NOW" chip in the log header shows the current level
  function drawNow(level) {
    if (!logNow) return;
    logNow.textContent = "NOW: " + level.toUpperCase();
    logNow.style.color = LEVEL_COLORS[level] || ACTION_COLOR;
    logNow.style.borderColor = LEVEL_COLORS[level] || ACTION_COLOR;
  }

  function buildLog() {
    const card = mk("section", "card el-card");

    const head = mk("h2", "el-head");
    logTitle = mk("span", "", "EVENT LOG · 0");
    head.appendChild(logTitle);

    const right = mk("span", "el-head-right");
    logNow = mk("span", "el-now", "");
    right.appendChild(logNow);

    const clear = mk("button", "es-clear", "CLEAR");
    clear.type = "button";
    clear.addEventListener("click", function () {
      events.length = 0;
      drawLog();
    });
    right.appendChild(clear);
    head.appendChild(right);

    card.appendChild(head);

    logList = mk("div", "el-list");
    card.appendChild(logList);
    return card;
  }

  // ===== Messages: chat between the doctor (Earth) and the astronaut =====
  //  - Doctor -> astronaut: shown in "MESSAGE FROM EARTH" on the watch (#earthBox)
  //  - astronaut -> doctor: notes (#btnNote), the I'M OK button and symptoms
  //    marked in "HOW DO YOU FEEL?". New ones are marked NEW until the doctor
  //    clicks anywhere on the messages card.

  const QUICK_REPLIES = [
    "ARE YOU OK?",
    "REST AND DRINK WATER",
    "WE WILL RE-CHECK IN 5 MIN",
    "STAND BY, WE ARE WITH YOU"
  ];

  const MAX_CHAT = 50;
  const chat = [];                  // oldest first: { id, from, text, time, read, seen }
  let chatId = 0;
  let chatCard = null;
  let chatList = null;
  let chatTitle = null;
  let chatBadge = null;
  let chatInput = null;
  let toastTimer = null;

  // Short message on the watch screen
  function showToast(text) {
    const t = document.getElementById("toast");
    if (!t) return;
    t.textContent = text;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 3000);
  }

  function unreadCount() {
    return chat.filter(function (m) { return m.from === "crew" && !m.seen; }).length;
  }

  // The doctor has looked at the messages
  function markSeen() {
    let changed = false;
    chat.forEach(function (m) {
      if (m.from === "crew" && !m.seen) { m.seen = true; changed = true; }
    });
    if (changed) drawChat();
  }

  // Draw the chat list in the Earth station
  function drawChat() {
    if (!chatList) return;
    chatList.innerHTML = "";

    const n = unreadCount();
    chatTitle.textContent = "MESSAGES · " + chat.length;
    chatBadge.textContent = n ? "● " + n + " NEW" : "";
    chatBadge.hidden = n === 0;
    chatCard.classList.toggle("has-new", n > 0);

    if (chat.length === 0) {
      chatList.appendChild(mk("p", "ch-empty", "NO MESSAGES YET"));
      return;
    }

    chat.forEach(function (m) {
      const fromEarth = m.from === "earth";
      const bubble = mk("div", "ch-msg " + (fromEarth ? "ch-earth" : "ch-crew"));

      const top = mk("div", "ch-top");
      top.appendChild(mk("span", "", fromEarth ? "DOCTOR" : PATIENT.id));
      const right = mk("span", "");
      if (!fromEarth && !m.seen) right.appendChild(mk("span", "ch-new", "NEW"));
      right.appendChild(mk("span", "ch-time", m.time));
      top.appendChild(right);
      bubble.appendChild(top);

      bubble.appendChild(mk("p", "ch-text", m.text));

      if (fromEarth) {
        bubble.appendChild(mk("p", "ch-state" + (m.read ? " read" : ""), m.read ? "READ" : "DELIVERED"));
      }
      chatList.appendChild(bubble);
    });

    chatList.scrollTop = chatList.scrollHeight;     // newest message at the bottom
  }

  // Draw the messages from Earth on the astronaut's watch
  function drawWatch() {
    const box = document.getElementById("earthBox");
    const list = document.getElementById("earthList");
    if (!box || !list) return;

    const fromEarth = chat.filter(function (m) { return m.from === "earth"; });
    list.innerHTML = "";
    box.hidden = fromEarth.length === 0;

    // Newest first, last 4 messages only
    fromEarth.slice(-4).reverse().forEach(function (m) {
      const row = mk("div", "ch-watch" + (m.read ? " read" : ""));

      const top = mk("div", "ch-watch-top");
      top.appendChild(mk("span", "", m.time));
      if (!m.read) {
        const ok = mk("button", "ch-got", "GOT IT");
        ok.type = "button";
        ok.addEventListener("click", function () {
          m.read = true;
          drawWatch();
          drawChat();
          addEvent("ASTRONAUT READ DOCTOR MESSAGE: " + shorten(m.text, 40), ACTION_COLOR);
        });
        top.appendChild(ok);
      } else {
        top.appendChild(mk("span", "ch-seen", "READ"));
      }
      row.appendChild(top);
      row.appendChild(mk("p", "ch-watch-text", m.text));
      list.appendChild(row);
    });
  }

  // Add one message. from = "earth" (doctor) or "crew" (astronaut)
  function addChat(from, text) {
    chat.push({
      id: ++chatId,
      from: from,
      text: text,
      time: clock(),
      read: false,
      seen: from === "earth"          // the doctor's own messages count as seen
    });
    if (chat.length > MAX_CHAT) chat.shift();
    drawChat();

    if (from === "earth") {
      drawWatch();
      showToast("MESSAGE FROM EARTH");
      addEvent("DOCTOR SENT: " + shorten(text, 50), EARTH_COLOR);
    }
  }

  // Send what is typed in the box
  function sendTyped() {
    const text = chatInput.value.trim();
    if (!text) return;
    addChat("earth", text);
    chatInput.value = "";
    chatInput.focus();
  }

  function buildChat() {
    const card = mk("section", "card ch-card");
    chatCard = card;

    const head = mk("h2", "ch-head");
    chatTitle = mk("span", "", "MESSAGES · 0");
    head.appendChild(chatTitle);

    const right = mk("span", "ch-head-right");
    chatBadge = mk("span", "ch-badge", "");
    chatBadge.hidden = true;
    right.appendChild(chatBadge);

    const clear = mk("button", "es-clear", "CLEAR");
    clear.type = "button";
    clear.addEventListener("click", function () {
      chat.length = 0;
      drawChat();
      drawWatch();
    });
    right.appendChild(clear);
    head.appendChild(right);
    card.appendChild(head);

    chatList = mk("div", "ch-list");
    card.appendChild(chatList);

    // Quick replies
    const quick = mk("div", "ch-quick");
    QUICK_REPLIES.forEach(function (q) {
      const b = mk("button", "chip", q);
      b.type = "button";
      b.addEventListener("click", function () { addChat("earth", q); });
      quick.appendChild(b);
    });
    card.appendChild(quick);

    // Message box + send button
    const row = mk("div", "ch-row");
    chatInput = mk("input", "ch-input");
    chatInput.type = "text";
    chatInput.maxLength = 200;
    chatInput.placeholder = "WRITE TO CREW-01...";
    chatInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter") sendTyped();
    });
    row.appendChild(chatInput);

    const send = mk("button", "es-clear ch-send", "SEND");
    send.type = "button";
    send.addEventListener("click", sendTyped);
    row.appendChild(send);
    card.appendChild(row);

    // Any click on the card means the doctor has seen the new messages
    card.addEventListener("click", markSeen);
    card.addEventListener("focusin", markSeen);

    return card;
  }

  // ----- 1. Level changes -----
  let lastLevel = document.body.dataset.level || "normal";
  let leftNormalAt = null;          // when the pulse left the normal level

  function onLevelChange() {
    const level = document.body.dataset.level || "normal";
    if (level === lastLevel) return;

    const hrEl = document.getElementById("hr");
    const o2El = document.getElementById("spo2");
    const pulse = hrEl ? hrEl.textContent : "?";
    const oxygen = o2El ? o2El.textContent : "?";

    let text;
    if (level === "normal") {
      text = "BACK TO NORMAL · " + pulse + " BPM";
      if (leftNormalAt) text += " · AFTER " + span(Date.now() - leftNormalAt);
      leftNormalAt = null;
    } else if (lastLevel === "normal") {
      leftNormalAt = Date.now();
      text = "PULSE WENT " + level.toUpperCase() + " · " + pulse + " BPM · OXYGEN " + oxygen + "%";
    } else {
      text = "LEVEL CHANGED: " + lastLevel.toUpperCase() + " → " + level.toUpperCase() +
             " · " + pulse + " BPM · OXYGEN " + oxygen + "%";
    }

    lastLevel = level;
    addEvent(text, LEVEL_COLORS[level]);
    drawNow(level);
  }

  // ----- 2. Contact with Earth -----
  let emAction = "";                // what the astronaut pressed: accept / refuse

  function onEmergencyState() {
    const box = document.getElementById("emergency");
    if (!box) return;
    const state = box.dataset.state;

    if (state === "counting") {
      emAction = "";
    } else if (state === "declined") {
      addEvent("REFUSED CONTACT WITH EARTH · AEGIS KEEPS MONITORING", EARTH_COLOR);
    } else if (state === "connecting") {
      if (emAction === "accept") {
        addEvent("ASTRONAUT ACCEPTED · CONTACTING EARTH", EARTH_COLOR);
      } else if (emAction === "refuse") {
        addEvent("AUTO CONTACT AFTER REFUSAL · CONTACTING EARTH", EARTH_COLOR);
      } else {
        addEvent("NO ANSWER IN 10 S · AUTO CONTACT · CONTACTING EARTH", EARTH_COLOR);
      }
    } else if (state === "connected") {
      addEvent("EARTH LINE OPEN", LEVEL_COLORS.normal);
    }
  }

  // ----- 3. Clicks on the watch -----
  // Capture phase: this runs BEFORE the watch's own handlers, so values such as
  // the note text can be read before the watch clears them.
  document.addEventListener("click", function (e) {
    const t = e.target;
    if (!t || !t.closest) return;

    // A problem card opened (only log when it opens, not when it closes)
    const head = t.closest("#alertList .alert-head");
    if (head) {
      const box = head.closest(".alert");
      setTimeout(function () {
        if (!box || !box.classList.contains("open")) return;
        const tagEl = head.querySelector(".alert-tag");
        const titleEl = head.querySelector(".alert-title");
        const num = tagEl ? tagEl.textContent.trim() : "";
        const title = titleEl ? titleEl.textContent.trim() : head.textContent.trim();
        addEvent("READ CARD " + num + " · " + title, ACTION_COLOR);
      }, 0);
      return;
    }

    // A symptom marked or unmarked in "HOW DO YOU FEEL?"
    const chip = t.closest("#groups .chip");
    if (chip) {
      setTimeout(function () {
        const d = chip.closest("details");
        const sm = d ? d.querySelector("summary") : null;
        const group = sm && sm.firstChild ? sm.firstChild.textContent.trim() : "";
        const name = chip.textContent.trim();
        if (chip.classList.contains("on")) {
          addEvent("REPORTED: " + name + (group ? " (" + group + ")" : ""), ACTION_COLOR);
          addChat("crew", "SYMPTOM: " + name + (group ? " (" + group + ")" : ""));
        } else {
          addEvent("REMOVED: " + name + (group ? " (" + group + ")" : ""), ACTION_COLOR);
        }
      }, 0);
      return;
    }

    // Buttons
    if (t.closest("#btnAccept")) { emAction = "accept"; return; }
    if (t.closest("#btnRefuse")) { emAction = "refuse"; return; }

    if (t.closest("#btnOk")) {
      addEvent("PRESSED I'M OK", ACTION_COLOR);
      addChat("crew", "I'M OK");
      return;
    }

    if (t.closest("#btnNote")) {
      const ta = document.getElementById("noteText");
      const txt = ta ? ta.value.trim() : "";
      if (txt) {
        addEvent("SENT A NOTE: " + shorten(txt, 60), ACTION_COLOR);
        addChat("crew", txt);       // the note also appears in the doctor's messages
      }
    }
  }, true);

  function startLog() {
    // The log sits in the right column, under the tests card
    const side = document.querySelector(".es-side");
    if (!side) return;
    side.appendChild(buildLog());
    drawLog();
    drawNow(lastLevel);

    // Watch the level and the emergency state for changes
    new MutationObserver(function () { setTimeout(onLevelChange, 0); })
      .observe(document.body, { attributes: true, attributeFilter: ["data-level"] });

    const em = document.getElementById("emergency");
    if (em) {
      new MutationObserver(onEmergencyState)
        .observe(em, { attributes: true, attributeFilter: ["data-state"] });
    }
  }

  // Other code can also add things by hand:
  //   EarthLog.add("TEXT", "#ef4444")     adds a log line
  //   EarthLog.say("earth", "TEXT")       adds a chat message
  window.EarthLog = { add: addEvent, say: addChat };

  // ----- Start -----
  drawSummary();

  // Left column: messages, then results. Right column: tests, then the event log
  const grid = document.getElementById("esGrid");
  grid.innerHTML = "";

  const left = mk("div", "es-left");
  left.appendChild(buildChat());
  left.appendChild(results);

  const side = mk("div", "es-side");
  side.appendChild(buildTests());

  grid.appendChild(left);
  grid.appendChild(side);
  drawResults();
  drawChat();

  startLog();
})();