/* EKG waveform synthesizer: builds a lead-II-style 6 s strip from asymmetric
   Gaussian components (P, Q, R, S, T), continuous baselines (flutter, fib, VF),
   and pacer spikes. Deterministic per seed. */
(function (global) {
  'use strict';
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  class Strip {
    constructor(seed) {
      this.rng = mulberry32(seed >>> 0);
      this.dur = 6; this.fs = 500;
      this.from = -1.8; this.to = 7.4;      // generate past the edges
      this.comps = []; this.fns = []; this.spikes = [];
      this.qrsT = []; this.pT = [];
      this.A = this.r(0.95, 1.45);           // R amplitude (mV)
      this.pAmp = this.r(0.11, 0.19);
      this.tAmp = this.r(0.22, 0.38);
      this.wander = { a: this.r(0.015, 0.06), f: this.r(0.12, 0.33), ph: this.r(0, 6.28) };
      this.noise = this.r(0.006, 0.016);
      this.atrialRate = null; this.pacerRate = null;
    }
    r(a, b) { return a + (b - a) * this.rng(); }
    ri(a, b) { return Math.floor(this.r(a, b + 1)); }
    pick(arr) { return arr[Math.floor(this.rng() * arr.length)]; }
    g(c, a, sl, sr) { this.comps.push([c, a, sl, sr || sl]); }
    fn(f) { this.fns.push(f); }

    /* P wave: onset t. shapes: normal | inverted | biphasic | peaked | notched | flat */
    p(t, amp, shape) {
      amp = amp == null ? this.pAmp : amp;
      const c = t + 0.05;
      switch (shape || 'normal') {
        case 'inverted': this.g(c, -Math.abs(amp) * 0.9, 0.022, 0.02); break;
        case 'biphasic': this.g(c - 0.018, amp * 0.8, 0.015); this.g(c + 0.025, -amp * 0.6, 0.016); break;
        case 'peaked': this.g(c, amp * 1.6, 0.016, 0.015); break;
        case 'notched': this.g(c - 0.02, amp * 0.85, 0.015); this.g(c + 0.022, amp * 0.85, 0.016); break;
        case 'flat': this.g(c, amp * 0.45, 0.026); break;
        default: this.g(c, amp, 0.024, 0.021);
      }
      this.pT.push(t);
    }
    spike(t, h) { this.spikes.push([t, h == null ? 1.3 : h]); }

    /* QRS (and, for wide kinds, discordant T) with onset q */
    qrs(q, kind, A, pol) {
      A = A == null ? this.A : A; pol = pol == null ? 1 : pol;
      this.qrsT.push(q);
      const g = this.g.bind(this);
      switch (kind) {
        case 'wide':      // PVC / ventricular escape: broad, bizarre, discordant T
          g(q + 0.055, 1.15 * A * pol, 0.03, 0.026); g(q + 0.135, -0.32 * A * pol, 0.03);
          g(q + 0.34, -0.36 * A * pol, 0.075, 0.06); break;
        case 'vt':
          g(q + 0.05, 1.15 * A * pol, 0.034, 0.03); g(q + 0.13, -0.5 * A * pol, 0.036);
          g(q + 0.25, -0.22 * A * pol, 0.05); break;
        case 'bbb':       // wide notched sinus complex (LBBB-like in II), discordant T
          g(q + 0.012, -0.05 * A, 0.007); g(q + 0.045, 0.78 * A, 0.014);
          g(q + 0.098, 0.88 * A, 0.018); g(q + 0.145, -0.12 * A, 0.02);
          g(q + 0.37, -0.26 * A, 0.065, 0.05); break;
        case 'paced':     // RV apical pacing: wide negative QS in II, positive T
          g(q + 0.065, -1.0 * A, 0.032, 0.034); g(q + 0.165, 0.16 * A, 0.03);
          g(q + 0.37, 0.34 * A, 0.07, 0.055); break;
        default:          // narrow
          g(q + 0.012, -0.07 * A, 0.006); g(q + 0.04, A, 0.0095);
          g(q + 0.066, -0.22 * A, 0.0085);
      }
    }
    /* A full beat at QRS onset q. o: {pr, pAmp, pShape, kind, rr, tAmp, A, pol, noT} */
    beat(q, o) {
      o = o || {};
      if (o.pr != null) this.p(q - o.pr, o.pAmp, o.pShape);
      const kind = o.kind || 'narrow';
      this.qrs(q, kind, o.A, o.pol);
      if (kind === 'narrow' && !o.noT) {
        const qt = clamp(0.4 * Math.sqrt(o.rr || 0.85), 0.26, 0.46);
        const ta = o.tAmp == null ? this.tAmp : o.tAmp;
        this.g(q + qt - 0.075, ta, 0.055 * qt / 0.4, 0.038 * qt / 0.4);
      }
    }

    samples() {
      if (this._s) return this._s;
      const n = Math.round(this.dur * this.fs) + 1, fs = this.fs, s = new Float32Array(n);
      for (const [c, a, sl, sr] of this.comps) {
        const i0 = Math.max(0, Math.floor((c - 5 * sl) * fs)), i1 = Math.min(n - 1, Math.ceil((c + 5 * sr) * fs));
        for (let i = i0; i <= i1; i++) {
          const t = i / fs, sg = t < c ? sl : sr, z = (t - c) / sg;
          s[i] += a * Math.exp(-0.5 * z * z);
        }
      }
      const w = this.wander;
      // smoothed noise (muscle/electrode) so it looks like a real trace, not static
      let nz = 0;
      for (let i = 0; i < n; i++) {
        const t = i / fs;
        let v = s[i] + w.a * Math.sin(2 * Math.PI * w.f * t + w.ph);
        for (const f of this.fns) v += f(t);
        nz = 0.55 * nz + 0.45 * (this.rng() * 2 - 1) * this.noise * 2.2;
        s[i] = clamp(v + nz, -2.3, 1.85);
      }
      this._s = s; return s;
    }

    /* rates measured from generated events inside the visible 6 s */
    rates() {
      const inWin = (arr) => arr.filter((t) => t >= 0 && t <= this.dur).sort((a, b) => a - b);
      const rate = (ts) => {
        if (ts.length < 2) return { bpm: ts.length * 10, irregular: false, n: ts.length };
        const rr = []; for (let i = 1; i < ts.length; i++) rr.push(ts[i] - ts[i - 1]);
        const m = rr.reduce((a, b) => a + b, 0) / rr.length;
        const range = Math.max(...rr) - Math.min(...rr);
        return { bpm: Math.round(60 / m), irregular: range > 0.12, n: ts.length };
      };
      const v = rate(inWin(this.qrsT));
      const a = this.atrialRate ? { bpm: Math.round(this.atrialRate), irregular: false } : rate(inWin(this.pT));
      return { v, a, pacer: this.pacerRate ? Math.round(this.pacerRate) : null };
    }
  }

  /* ---------- SVG rendering on standard ECG paper ---------- */
  let uid = 0;
  const MMPS = 25, MMPMV = 10, H = 40, BASE = 23;
  function render(strip, t0, t1, opts) {
    opts = opts || {};
    const s = strip.samples(), fs = strip.fs;
    const W = (t1 - t0) * MMPS, id = 'g' + (++uid);
    const i0 = Math.round(t0 * fs), i1 = Math.round(t1 * fs);
    let d = '';
    for (let i = i0; i <= i1; i++) {
      const x = ((i / fs - t0) * MMPS).toFixed(2), y = (BASE - s[i] * MMPMV).toFixed(2);
      d += (i === i0 ? 'M' : 'L') + x + ' ' + y;
    }
    let sp = '';
    for (const [t, h] of strip.spikes) {
      if (t < t0 || t > t1) continue;
      const x = ((t - t0) * MMPS).toFixed(2), y0 = BASE - s[Math.round(t * fs)] * MMPMV;
      sp += `<line x1="${x}" x2="${x}" y1="${(y0 + 1.5).toFixed(2)}" y2="${(y0 - h * MMPMV).toFixed(2)}" class="spk"/>`;
    }
    let ticks = '';
    for (let t = Math.ceil(t0); t <= t1 + 1e-6; t++) {
      if (t % 3 === 0 && t > 0 && t < strip.dur) { const x = (t - t0) * MMPS; ticks += `<line x1="${x}" x2="${x}" y1="0" y2="2.4" class="tick"/>`; }
    }
    const cal = opts.label ? `<text x="1.2" y="4.2" class="lbl">II</text><text x="${W - 1}" y="4.2" class="lbl" text-anchor="end">25 mm/s · 10 mm/mV</text>` : '';
    return `<svg class="ekg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="EKG rhythm strip">
<defs><pattern id="${id}s" width="1" height="1" patternUnits="userSpaceOnUse"><path d="M1 0V1H0" fill="none" stroke="#f3b2bd" stroke-width="0.06"/></pattern>
<pattern id="${id}l" width="5" height="5" patternUnits="userSpaceOnUse"><rect width="5" height="5" fill="url(#${id}s)"/><path d="M5 0V5H0" fill="none" stroke="#e0788b" stroke-width="0.16"/></pattern></defs>
<rect width="${W}" height="${H}" fill="#fff5f6"/><rect width="${W}" height="${H}" fill="url(#${id}l)"/>${ticks}${cal}
<path d="${d}" class="trace"/>${sp}</svg>`;
  }

  global.EKG = { Strip, render, mulberry32 };
})(window);
