// Backend prototype page: polls the API and wires the buttons. Plain JS, no build step.
const $ = (sel) => document.querySelector(sel);

async function api(path, body) {
  const res = await fetch(path, body === undefined ? {} : {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

function el(tag, props = {}, ...children) {
  const node = Object.assign(document.createElement(tag), props);
  children.flat().forEach((c) => node.append(c instanceof Node ? c : document.createTextNode(c ?? '')));
  return node;
}

function renderSpacecraft(s) {
  const last = s.readings.at(-1);
  $('#hr').textContent = last ? Math.round(last.heart_rate) : '–';
  $('#spo2').textContent = last?.spo2 != null ? last.spo2.toFixed(0) : '–';
  $('#activity').textContent = last ? last.activity : '–';
  $('#quality').textContent = last ? `signal ${last.signal_quality}` : 'signal –';

  const hrs = s.readings.map((r) => r.heart_rate);
  if (hrs.length > 1) {
    const lo = Math.min(...hrs, 50), hi = Math.max(...hrs, 130);
    $('#line').setAttribute('points', hrs.map((v, i) =>
      `${(i / (hrs.length - 1)) * 300},${70 - ((v - lo) / (hi - lo)) * 64 - 3}`).join(' '));
  }

  const a = s.latest_alert, box = $('#alert');
  box.replaceChildren();
  box.className = 'card ' + (a ? a.severity : 'muted');
  if (!a) box.append('No alerts yet.');
  else {
    box.append(el('b', {}, `${a.severity.toUpperCase()} · ${a.metric}`), el('p', {}, a.reason));
    a.todo.forEach((step) => {
      const cb = el('input', { type: 'checkbox', checked: a.done.includes(step), disabled: a.done.includes(step) });
      cb.onchange = () => api(`/api/alerts/${a.alert_id}/done`, { step }).then(refresh);
      box.append(el('label', {}, cb, ' ', step));
    });
  }

  document.querySelectorAll('[data-feel]').forEach((b) => b.classList.toggle('on', s.checkin?.feeling === b.dataset.feel));
  $('#eta-see').textContent = `~${s.eta.earth_sees_in_min} min`;
  $('#eta-reply').textContent = `~${s.eta.earliest_reply_in_min} min`;

  $('#replies').replaceChildren(...(s.replies.length
    ? s.replies.map((r) => el('li', {}, el('b', {}, r.author + ': '), r.text))
    : [el('li', { className: 'muted' }, 'None yet.')]));

  const link = $('#link');
  link.textContent = s.link.state;
  link.className = 'badge ' + s.link.state;
  $('#outbox').replaceChildren(...(s.outbox.length ? s.outbox.map((b) =>
    el('li', { className: b.status === 'delivered' ? 'delivered' : '' },
      el('span', { className: 'dot ' + b.layer }), `${b.layer} · ${b.severity} · ${b.size_bytes} B`))
    : [el('li', { className: 'muted' }, 'Empty.')]));
}

function renderEarth(e) {
  const box = $('#briefs');
  if (!e.briefs.length) return box.replaceChildren(el('p', { className: 'muted' }, 'Nothing received yet.'));
  box.replaceChildren(...e.briefs.map((b) => {
    const h = b.layers.headline || {}, c = b.layers.context, ev = b.layers.evidence;
    const card = el('div', { className: 'card brief ' + (h.sev || '') },
      el('b', {}, `${h.a || '?'} · ${h.m || '?'} ${h.val ?? ''} (normal ${h.base ?? '–'}) · ${h.sev || ''}`),
      el('div', { className: 'layers' }, ['headline', 'context', 'evidence'].map((l) =>
        el('span', {}, el('span', { className: 'dot ' + l }), b.layers[l] ? `${l} ✓` : `${l} waiting`))));
    if (c) {
      card.append(el('p', {}, c.reason));
      if (c.checkin) card.append(el('p', {}, `Astronaut says: ${c.checkin.feeling}${c.checkin.symptom ? ', ' + c.checkin.symptom : ''}`));
      if (c.done.length) card.append(el('p', {}, `Done: ${c.done.join(', ')}`));
    }
    if (ev) card.append(el('p', { className: 'muted small' }, `Evidence: ${ev.hr.length} readings around the event`));
    const text = el('textarea', { rows: 2, placeholder: 'Reply to the crew…' });
    const send = el('button', {}, 'Send reply');
    send.onclick = () => text.value.trim() && api('/api/earth/reply', { brief_id: b.brief_id, text: text.value.trim() }).then(refresh);
    card.append(text, send);
    return card;
  }));
}

function renderStats(st) {
  const rows = [['Readings', st.readings], ['Briefs', st.briefs], ['Queued bundles', st.queued],
    ['Delivered bundles', st.delivered], ['Bytes sent', st.bytes_sent], ['Raw readings ≈', st.raw_bytes_equivalent]];
  $('#stats').replaceChildren(...rows.flatMap(([k, v]) => [el('dt', {}, k), el('dd', {}, String(v))]));
}

let busy = false;
async function refresh() {
  if (busy) return;
  busy = true;
  try {
    const [s, e, st] = await Promise.all([api('/api/spacecraft'), api('/api/earth'), api('/api/stats')]);
    renderSpacecraft(s); renderEarth(e); renderStats(st);
  } catch (err) { console.error(err); }
  finally { busy = false; }
}

document.addEventListener('click', (ev) => {
  const b = ev.target.closest('button');
  if (!b) return;
  let call;
  if (b.dataset.sim) call = api('/api/sim/step', { scenario: b.dataset.sim, count: Number(b.dataset.count) });
  else if (b.dataset.link) call = api('/api/link', { state: b.dataset.link });
  else if (b.dataset.window) call = api('/api/link/window', { budget_bytes: Number(b.dataset.window) });
  else if (b.dataset.feel) call = api('/api/checkin', { feeling: b.dataset.feel, symptom: $('#symptom').value.trim() || null });
  else if (b.id === 'reset') call = api('/api/reset', {});
  call?.then(refresh).catch((err) => alert(err.message));
});

refresh();
setInterval(refresh, 1500);
