// Earth station: live readings mirrored from the astronaut's watch.
// It only READS the watch elements (#hr, #spo2, #sleep, #reason, #linkText,
// #trace, #tip and body[data-level]), so script.js is not changed.
(function () {
  "use strict";

  const BASELINE_PULSE = 72;   // same baseline as the patient file

  function mk(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function mkSvg(tag, cls) {
    const e = document.createElementNS("http://www.w3.org/2000/svg", tag);
    if (cls) e.setAttribute("class", cls);
    return e;
  }

  // Text of a watch element, or "--" when it does not exist
  function read(id) {
    const e = document.getElementById(id);
    return e ? e.textContent.trim() : "--";
  }

  // ----- Build the card: readings on the left, ECG on the right -----
  const card = mk("section", "card lv-card");
  card.dataset.level = "normal";

  const left = mk("div", "lv-left");
  const right = mk("div", "lv-right");
  card.appendChild(left);
  card.appendChild(right);

  // Title and link state
  const head = mk("h2", "lv-head");
  head.appendChild(mk("span", "", "LIVE FROM CREW-01"));
  const link = mk("span", "lv-link", "LINK: --");
  head.appendChild(link);
  left.appendChild(head);

  // Pulse, oxygen, sleep: each box has a label, a number node and a unit
  const row = mk("div", "lv-row");

  function box(label, unit, big) {
    const b = mk("div", big ? "lv-box big" : "lv-box");
    b.appendChild(mk("small", "", label));

    const val = mk("span", "lv-val");
    const num = document.createTextNode("--");      // updated later
    val.appendChild(num);
    val.appendChild(mk("span", "lv-unit", unit));

    b.appendChild(val);
    row.appendChild(b);
    return num;
  }

  const pulseNum  = box("PULSE",  "BPM", true);
  const oxygenNum = box("OXYGEN", "%",   false);
  const sleepNum  = box("SLEEP",  "HRS", false);
  left.appendChild(row);

  // Status, difference from baseline and reason
  const statusRow = mk("div", "lv-status-row");
  const status = mk("span", "lv-status", "● NORMAL");
  const delta = mk("span", "lv-delta", "");
  statusRow.appendChild(status);
  statusRow.appendChild(delta);
  left.appendChild(statusRow);

  const reason = mk("p", "lv-reason", "");
  left.appendChild(reason);

  // Mirrored ECG: same shape and proportions as the watch ECG
  right.appendChild(mk("small", "lv-ecg-label", "LIVE ECG"));

  const ecg = mk("div", "lv-ecg");
  const svg = mkSvg("svg");
  svg.setAttribute("viewBox", "0 0 300 70");

  const base = mkSvg("line", "lv-base");
  base.setAttribute("x1", "0");
  base.setAttribute("x2", "300");
  base.setAttribute("y1", "48");
  base.setAttribute("y2", "48");

  const trace = mkSvg("polyline", "lv-trace");

  const tip = mkSvg("circle", "lv-tip");
  tip.setAttribute("r", "3.5");
  tip.setAttribute("cx", "299");
  tip.setAttribute("cy", "48");

  svg.appendChild(base);
  svg.appendChild(trace);
  svg.appendChild(tip);
  ecg.appendChild(svg);
  right.appendChild(ecg);

  // Place it right under the patient file
  const summary = document.getElementById("esSummary");
  if (summary) summary.insertAdjacentElement("afterend", card);

  // ----- Update the numbers (5 times a second, so they match the watch) -----
  function update() {
    const level = document.body.dataset.level || "normal";
    card.dataset.level = level;

    const pulse = read("hr");
    pulseNum.nodeValue  = pulse;
    oxygenNum.nodeValue = read("spo2");
    sleepNum.nodeValue  = read("sleep");

    status.textContent = "● " + level.toUpperCase();

    // Difference from the baseline
    const p = Number(pulse);
    if (isNaN(p)) {
      delta.textContent = "";
    } else {
      const d = p - BASELINE_PULSE;
      delta.textContent = (d > 0 ? "+" : "") + d + " VS BASELINE " + BASELINE_PULSE;
    }

    reason.textContent = read("reason");

    // Link state from the watch: "EARTH LINK: STANDBY" -> "STANDBY"
    const linkText = read("linkText")
      .replace(/^EARTH LINK:\s*/i, "")
      .replace(/^CONNECTED TO EARTH$/i, "CONNECTED");
    link.textContent = "LINK: " + linkText;
  }

  // ----- Mirror the ECG (about 20 times a second) -----
  function mirrorEcg() {
    const src = document.getElementById("trace");
    const dot = document.getElementById("tip");
    if (src) trace.setAttribute("points", src.getAttribute("points") || "");
    if (dot) tip.setAttribute("cy", dot.getAttribute("cy") || "48");
  }

  update();
  setInterval(update, 200);
  setInterval(mirrorEcg, 50);
})();