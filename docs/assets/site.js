// Builds both sidebars from the page's h2 headings, highlights the current section,
// and handles the mobile drawer and theme toggle.
(function () {
  const content = document.getElementById('content');
  const headings = [...content.querySelectorAll('h2')];
  const slug = (s) => s.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-');
  headings.forEach((h) => { if (!h.id) h.id = slug(h.textContent); });

  const fill = (ul) => headings.forEach((h) => {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = '#' + h.id;
    a.textContent = h.textContent;
    li.appendChild(a);
    ul.appendChild(li);
  });
  const navList = document.querySelector('.nav-sections');
  const tocList = document.querySelector('.toc');
  fill(navList);
  fill(tocList);

  // Highlight the section in view
  const links = [...document.querySelectorAll('.nav-sections a, .toc a')];
  const setActive = (id) => links.forEach((a) => a.classList.toggle('active', a.getAttribute('href') === '#' + id));
  const onScroll = () => {
    let current = headings[0] && headings[0].id;
    for (const h of headings) if (h.getBoundingClientRect().top < 120) current = h.id;
    if (current) setActive(current);
  };
  document.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Filter the left nav
  document.querySelector('.filter').addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    document.querySelectorAll('.left li').forEach((li) => { li.hidden = q && !li.textContent.toLowerCase().includes(q); });
  });

  // Mobile drawer
  const left = document.getElementById('left');
  const btn = document.querySelector('.menu-btn');
  const scrim = document.querySelector('.scrim');
  const toggle = (open) => { left.classList.toggle('open', open); scrim.hidden = !open; btn.setAttribute('aria-expanded', open); };
  btn.addEventListener('click', () => toggle(!left.classList.contains('open')));
  scrim.addEventListener('click', () => toggle(false));
  left.addEventListener('click', (e) => { if (e.target.closest('a')) toggle(false); });

  // Theme toggle, remembered per browser
  const root = document.documentElement;
  try { const t = localStorage.getItem('theme'); if (t) root.dataset.theme = t; } catch (e) {}
  document.querySelector('.theme-btn').addEventListener('click', () => {
    const dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    root.dataset.theme = dark ? 'light' : 'dark';
    try { localStorage.setItem('theme', root.dataset.theme); } catch (e) {}
  });
})();

// Animated "How it works" intro: steps through the story, one caption per step.
(function () {
  const intro = document.querySelector('.intro');
  if (!intro) return;
  const steps = [
    'The watch reads the astronaut’s heart rate and sends it to the spacecraft over Bluetooth.',
    'AEGIS compares it with that astronaut’s normal. Something is off, so it raises an alert.',
    'MEDLINK turns the alert into a PulseBrief and sends it toward Earth.',
    'The link breaks. The PulseBrief waits in the outbox in three layers: headline, context, evidence. The crew screen shows what to do now.',
    'The link opens for only a few seconds. The headline goes first, so doctors already know what happened.',
    'At the next window, the context and evidence follow. Nothing is lost.',
    'Doctors on Earth reply. The answer travels back and shows on the crew screen.'
  ];
  const text = intro.querySelector('.intro-text');
  const num = intro.querySelector('.intro-num');
  const dots = intro.querySelector('.intro-dots');
  const playBtn = intro.querySelector('.intro-play');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let step = 0, timer = null, playing = !reduce;

  steps.forEach((_, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('aria-label', 'Step ' + (i + 1));
    b.addEventListener('click', () => go(i));
    dots.appendChild(b);
  });

  function go(i) {
    step = (i + steps.length) % steps.length;
    intro.dataset.step = '';            // restart CSS animations
    void intro.offsetWidth;
    intro.dataset.step = String(step + 1);
    num.textContent = step + 1;
    text.textContent = steps[step];
    [...dots.children].forEach((d, j) => d.classList.toggle('on', j === step));
    schedule();
  }
  function schedule() {
    clearTimeout(timer);
    if (playing) timer = setTimeout(() => go(step + 1), 4200);
  }
  function setPlaying(p) {
    playing = p;
    playBtn.textContent = p ? '❚❚' : '▶';
    playBtn.setAttribute('aria-label', p ? 'Pause' : 'Play');
    schedule();
  }
  intro.querySelector('.intro-prev').addEventListener('click', () => go(step - 1));
  intro.querySelector('.intro-next').addEventListener('click', () => go(step + 1));
  playBtn.addEventListener('click', () => setPlaying(!playing));
  setPlaying(playing);
  go(0);
})();

// Crew screen example: the re-measure countdown ticks down, then restarts.
(function () {
  const el = document.querySelector('.brief .tick');
  if (!el || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  let s = 299;
  setInterval(() => {
    s = s > 0 ? s - 1 : 299;
    el.textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }, 1000);
})();
