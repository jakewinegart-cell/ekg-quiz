(function () {
  'use strict';
  const LEVELS = { 1: 'Level 1 · Basic', 2: 'Level 2 · Intermediate', 3: 'Level 3 · Advanced', 4: 'Level 4 · Expert' };
  const STRIPS_PER_RHYTHM = 2;
  const byId = Object.fromEntries(RHYTHMS.map((r) => [r.id, r]));
  const $ = (id) => document.getElementById(id);
  const hash = (s) => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

  // ---- deck ----
  function baseDeck() {
    const d = [];
    RHYTHMS.forEach((r) => { for (let k = 0; k < STRIPS_PER_RHYTHM; k++) d.push({ rid: r.id, seed: (hash(r.id) + k * 7919) >>> 0, level: r.level }); });
    return d;
  }
  function shuffle(a, rng) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function orderedDeck() {         // simple -> complex, shuffled within a level, avoiding back-to-back repeats
    const rng = EKG.mulberry32(12345); const out = [];
    [1, 2, 3, 4].forEach((L) => {
      let lv = shuffle(baseDeck().filter((c) => c.level === L), rng);
      for (let tries = 0; tries < 50; tries++) { let bad = false; for (let i = 1; i < lv.length; i++) if (lv[i].rid === lv[i - 1].rid) { const j = Math.floor(rng() * lv.length); [lv[i], lv[j]] = [lv[j], lv[i]]; bad = true; } if (!bad) break; }
      if (L === 1) { const i = lv.findIndex((c) => c.rid === 'nsr'); lv.unshift(lv.splice(i, 1)[0]); }
      out.push(...lv);
    });
    return out;
  }
  function shuffledDeck() { return shuffle(baseDeck(), EKG.mulberry32((Math.random() * 2 ** 32) >>> 0)); }

  const cache = new Map();
  function build(card) {
    const key = card.rid + ':' + card.seed;
    if (cache.has(key)) return cache.get(key);
    const r = byId[card.rid], S = new EKG.Strip(card.seed);
    r.gen(S);
    const rng = EKG.mulberry32(card.seed ^ 0x9e3779b9);
    const pool = r.similar.filter((x) => byId[x] && x !== r.id);
    shuffle(pool, rng);
    const picks = pool.slice(0, 3);
    const extra = shuffle(RHYTHMS.filter((x) => x.id !== r.id && !picks.includes(x.id) && Math.abs(x.level - r.level) <= 1).map((x) => x.id), rng);
    while (picks.length < 3) picks.push(extra.shift());
    const opts = shuffle([r.id, ...picks], rng);
    const out = { r, S, opts, rate: rateText(r, S.rates()) };
    cache.set(key, out); return out;
  }
  function rateText(r, R) {
    const v = R.v, irr = v.irregular ? ' <span class="sub">(irregular, average)</span>' : '';
    switch (r.rateMode) {
      case 'vf': return 'Heart rate: <b>Not measurable</b> <div class="sub">No organized QRS complexes</div>';
      case 'asys': return 'Heart rate: <b>0 bpm</b> <div class="sub">No ventricular complexes</div>';
      case 'tdp': return `Heart rate: <b>≈ ${v.bpm} bpm</b> <div class="sub">Polymorphic; approximate</div>`;
      case 'flutter': return `Ventricular rate: <b>${v.bpm} bpm</b>${irr}<div class="sub">Atrial (flutter-wave) rate ≈ ${R.a.bpm}/min</div>`;
      case 'av': return `Ventricular rate: <b>${v.bpm} bpm</b>${irr}<div class="sub">Atrial (P-wave) rate ${R.a.bpm} bpm</div>`;
      case 'paced': return `Heart rate: <b>${v.bpm} bpm</b>${irr}${R.pacer ? `<div class="sub">Pacer spikes at ${R.pacer}/min</div>` : ''}`;
      default: return `Heart rate: <b>${v.bpm} bpm</b>${irr}`;
    }
  }

  // ---- state ----
  let deck = orderedDeck(), idx = 0, answers = {}, shuffled = false;
  const score = () => { const a = Object.values(answers); return { y: a.length, x: a.filter((z) => z.ok).length }; };

  function show(animate) {
    const card = deck[idx], b = build(card), r = b.r, ans = answers[idx];
    $('progress').textContent = `Strip ${idx + 1} / ${deck.length}`;
    $('levelTag').textContent = LEVELS[r.level];
    $('barFill').style.width = ((idx + 1) / deck.length * 100) + '%';
    const s = score(); $('score').textContent = `You got ${s.x} out of ${s.y} correct`;
    $('scenario').hidden = !r.scenario; $('scenario').textContent = r.scenario ? '⚠ ' + r.scenario : '';
    $('stripWrap').innerHTML = EKG.render(b.S, 0, b.S.dur, { label: true });
    $('rateBox').innerHTML = b.rate;
    $('options').innerHTML = b.opts.map((id, i) => `<button class="opt" data-id="${id}"><span class="L">${'ABCD'[i]}</span><span>${byId[id].name}</span></button>`).join('');
    $('options').querySelectorAll('.opt').forEach((el) => el.addEventListener('click', () => answer(el.dataset.id)));
    $('feedback').hidden = true;
    if (ans) paintAnswer(ans.choice);
    $('prevBtn').disabled = idx === 0;
    $('nextBtn').textContent = idx === deck.length - 1 ? 'Finish ✓' : 'Next ›';
    if (animate) { const c = $('card'); c.classList.remove('anim'); void c.offsetWidth; c.classList.add('anim'); }
  }
  function paintAnswer(choice) {
    const r = build(deck[idx]).r, ok = choice === r.id;
    $('options').querySelectorAll('.opt').forEach((el) => {
      el.disabled = true;
      if (el.dataset.id === r.id) el.classList.add('correct');
      else if (el.dataset.id === choice) el.classList.add('wrong');
      else el.classList.add('dim');
    });
    const v = $('verdict'); v.className = 'verdict ' + (ok ? 'ok' : 'bad');
    v.textContent = ok ? '✓ Correct: ' + r.name : '✗ Not quite. It’s ' + r.name;
    $('why').innerHTML = r.why.map((w) => `<li>${w}</li>`).join('');
    $('tx').textContent = r.tx;
    $('feedback').hidden = false;
  }
  function answer(choice) {
    if (answers[idx]) return;
    answers[idx] = { choice, ok: choice === deck[idx].rid };
    paintAnswer(choice);
    const s = score(); $('score').textContent = `You got ${s.x} out of ${s.y} correct`;
  }
  function go(d) {
    const n = idx + d;
    if (n < 0) return;
    if (n >= deck.length) { const s = score(); alert(`End of deck. You got ${s.x} out of ${s.y} correct.`); return; }
    idx = n; show(true); window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function restart(newDeck) { deck = newDeck; idx = 0; answers = {}; show(true); }

  $('nextBtn').addEventListener('click', () => go(1));
  $('prevBtn').addEventListener('click', () => go(-1));
  $('restartBtn').addEventListener('click', () => { if (confirm('Restart the deck and reset your score?')) restart(shuffled ? shuffledDeck() : orderedDeck()); });
  $('shuffleBtn').addEventListener('click', () => {
    shuffled = !shuffled; $('shuffleBtn').setAttribute('aria-pressed', String(shuffled));
    restart(shuffled ? shuffledDeck() : orderedDeck());
  });
  document.addEventListener('keydown', (e) => {
    if (!$('zoom').hidden) { if (e.key === 'Escape') $('zoom').hidden = true; return; }
    if (e.key === 'ArrowRight') go(1);
    else if (e.key === 'ArrowLeft') go(-1);
    else { const i = 'abcd'.indexOf(e.key.toLowerCase()); const j = '1234'.indexOf(e.key); const k = i >= 0 ? i : j; if (k >= 0) { const el = $('options').querySelectorAll('.opt')[k]; if (el && !el.disabled) el.click(); } }
  });
  // swipe: left = next, right = back
  let sx = null, sy = null;
  $('card').addEventListener('touchstart', (e) => { const t = e.changedTouches[0]; sx = t.clientX; sy = t.clientY; }, { passive: true });
  $('card').addEventListener('touchend', (e) => {
    if (sx == null) return; const t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy; sx = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
  }, { passive: true });
  // zoom: two 3-second rows at larger scale
  $('stripWrap').addEventListener('click', () => {
    const S = build(deck[idx]).S;
    $('zoomBody').innerHTML = EKG.render(S, 0, 3, { label: true }) + '<div class="zcap">0–3 s</div>' + EKG.render(S, 3, 6, {}) + '<div class="zcap">3–6 s · each small box = 0.04 s / 0.1 mV; large box = 0.20 s</div>';
    $('zoom').hidden = false;
  });
  $('zoomClose').addEventListener('click', () => { $('zoom').hidden = true; });
  $('zoom').addEventListener('click', (e) => { if (e.target.id === 'zoom') $('zoom').hidden = true; });

  window.__ekg = { deck: () => deck, build, go, answer, get idx() { return idx; } };   // test hook
  show(false);
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
