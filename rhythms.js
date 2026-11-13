/* Rhythm definitions: generator + teaching content. Levels 1 (basic) to 4 (expert). */
(function (global) {
  'use strict';
  // ---- generator helpers ----
  function run(S, rate, jitter) {               // regular times from before 0 to past 6 s
    const rr = 60 / rate, out = []; let t = S.r(-1.4, -0.3);
    while (t < S.to) { out.push(t); t += rr * (1 + S.r(-(jitter || 0.012), jitter || 0.012)); }
    return { times: out, rr };
  }
  function sinus(S, rate, o) {
    o = o || {}; const { times, rr } = run(S, rate); const pr = o.pr || S.r(0.14, 0.19);
    times.forEach((q) => S.beat(q, Object.assign({ pr, rr }, o.beat || {})));
    return { rr, pr };
  }
  function fib(S, amp) {                         // fibrillatory baseline
    const comps = []; for (let i = 0; i < 5; i++) comps.push([S.r(4.5, 8.5), S.r(0.4, 1) * amp, S.r(0, 6.28), S.r(0.2, 0.8), S.r(0, 6.28)]);
    S.fn((t) => comps.reduce((v, [f, a, ph, mf, mph]) => v + a * Math.sin(2 * Math.PI * f * t + ph) * (0.6 + 0.4 * Math.sin(2 * Math.PI * mf * t + mph)), 0));
  }
  function flutter(S, ratios) {                  // negative sawtooth F waves + conducted QRS
    const fr = S.r(270, 330), F = 60 / fr, amp = S.r(0.2, 0.3), ph = S.r(0, F);
    S.atrialRate = fr;
    S.fn((t) => { let x = ((t - ph) / F) % 1; if (x < 0) x += 1; return amp * (x < 0.72 ? 0.5 - x / 0.72 : -0.5 + (x - 0.72) / 0.28); });
    const cond = S.r(0.2, 0.28); let k = Math.floor((S.from - ph) / F);
    let last = null;
    while (ph + k * F < S.to) {
      const q = ph + k * F + cond;
      S.beat(q, { rr: last ? q - last : 0.8, tAmp: S.tAmp * 0.45 }); last = q;
      k += typeof ratios === 'number' ? ratios : S.pick(ratios);
    }
  }
  function ectopicSinus(S, rate, pattern, mk) {   // pattern(i) -> 'N' | 'V' | 'V2' | 'A' | 'J'
    const rr = 60 / rate, pr = S.r(0.14, 0.18); let t = S.r(-1.2, -0.3), i = 0, last = -9;
    const pol = S.pick([1, -1]), Av = S.A * S.r(0.95, 1.25);
    while (t < S.to) {
      const k = pattern(i);
      if (k === 'N') { S.beat(t, { pr, rr }); last = t; t += rr; }
      else if (k === 'V' || k === 'V2') {          // PVC(s): full compensatory pause, sinus P buried
        const v1 = last + rr * S.r(0.52, 0.62); S.qrs(v1, 'wide', Av, pol);
        let lastV = v1;
        if (k === 'V2') { lastV = v1 + rr * S.r(0.4, 0.48); S.qrs(lastV, 'wide', Av * S.r(0.9, 1.05), pol); }
        S.p(t - pr, S.pAmp * 0.9);                 // non-conducted sinus P hidden in PVC/T
        t += rr; if (t - lastV < 0.45 && k === 'V2') { S.p(t - pr, S.pAmp * 0.9); t += rr; }
        last = t - rr;                             // keeps sinus timing
      } else if (k === 'A' || k === 'J') {         // premature supraventricular beat, resets sinus
        const q = last + rr * S.r(0.55, 0.64);
        if (k === 'A') S.beat(q, { pr: S.r(0.12, 0.16), rr: rr * 0.65, pShape: S.pick(['biphasic', 'peaked', 'notched']), pAmp: S.pAmp });
        else S.beat(q, S.rng() < 0.6 ? { pr: 0.08, rr: rr * 0.65, pShape: 'inverted' } : { rr: rr * 0.65 });
        last = q; t = q + rr * S.r(1.0, 1.05);
      }
      i++;
    }
  }
  function junctional(S, rate) {
    const { times, rr } = run(S, rate, 0.01), mode = S.pick(['before', 'none', 'after']);
    times.forEach((q) => {
      if (mode === 'before') S.beat(q, { pr: S.r(0.06, 0.1), pShape: 'inverted', rr });
      else { S.beat(q, { rr }); if (mode === 'after') S.p(q + 0.11, S.pAmp, 'inverted'); }
    });
  }
  function ventricular(S, rate, kind) {
    const { times, rr } = run(S, rate, 0.03), pol = S.pick([1, -1]);
    times.forEach((q) => S.qrs(q, kind || 'wide', S.A * S.r(1.0, 1.1), pol));
    return rr;
  }
  function atrialP(S, rate, phase) {             // independent sinus P waves, returns times
    const pp = 60 / rate; const out = []; for (let t = (phase == null ? S.r(-0.8, 0) : phase); t < S.to; t += pp * (1 + S.r(-0.01, 0.01))) out.push(t); return out;
  }

  const R = [];
  const add = (o) => R.push(o);

  // ===== LEVEL 1 =====
  add({ id: 'nsr', name: 'Normal sinus rhythm', level: 1, similar: ['sbrady', 'stach', 'sarr', 'first'],
    gen: (S) => sinus(S, S.r(62, 96)),
    why: ['Regular R-R intervals', 'Rate 60–100 bpm', 'Upright P before every QRS in lead II, PR 0.12–0.20 s', 'Narrow QRS (< 0.12 s)'],
    tx: 'None. Treat the patient, not the monitor; assess symptoms and vitals.' });
  add({ id: 'sbrady', name: 'Sinus bradycardia', level: 1, similar: ['nsr', 'junc', 'first', 'twoone'],
    gen: (S) => sinus(S, S.r(36, 55)),
    why: ['Regular rhythm', 'Rate < 60 bpm', 'Normal upright P before each QRS, constant normal PR', 'Narrow QRS; looks like NSR, only slower'],
    tx: 'Asymptomatic: monitor and look for a cause. Symptomatic/unstable: atropine 1 mg IV q3–5 min (max 3 mg); if ineffective, transcutaneous pacing or dopamine 5–20 mcg/kg/min or epinephrine 2–10 mcg/min.' });
  add({ id: 'stach', name: 'Sinus tachycardia', level: 1, similar: ['svt', 'nsr', 'flut2', 'jtach'],
    gen: (S) => sinus(S, S.r(104, 145), { pr: S.r(0.12, 0.15) }),
    why: ['Regular rhythm', 'Rate 100–150 bpm (rarely higher)', 'P wave visible before each QRS (may run into the preceding T)', 'Narrow QRS; gradual onset, so think about the cause'],
    tx: 'Treat the underlying cause (pain, fever, hypovolemia, hypoxia, anxiety, sepsis). Do not cardiovert sinus tachycardia.' });
  add({ id: 'asys', name: 'Asystole', level: 1, similar: ['vffine', 'idio', 'chb'], rateMode: 'asys',
    gen: (S) => { S.A = 0; S.wander.a = S.r(0.02, 0.06); S.noise *= 0.8; if (S.rng() < 0.35) atrialP(S, S.r(25, 40)).forEach((t) => S.p(t, S.pAmp * 0.8)); },
    why: ['Essentially flat line: no QRS complexes', 'Slight undulation is baseline drift, not organized activity', 'Occasional P waves may appear ("P-wave asystole") with no ventricular response', 'Confirm in a second lead and check that gain/leads are correct (rule out fine VF)'],
    tx: 'Non-shockable: high-quality CPR, epinephrine 1 mg IV/IO ASAP then q3–5 min, airway, and treat H’s & T’s. Do NOT defibrillate.' });
  add({ id: 'vfc', name: 'Ventricular fibrillation (coarse)', level: 1, similar: ['vffine', 'tdp', 'vt'], rateMode: 'vf',
    gen: (S) => vfGen(S, S.r(0.45, 0.75)),
    why: ['Chaotic, irregular deflections of varying shape and amplitude', 'No identifiable P, QRS, or T waves', 'Rate not measurable', 'Coarse = large amplitude (> 3 mm); patient is pulseless'],
    tx: 'Shockable: immediate defibrillation (biphasic 120–200 J) + CPR; epinephrine 1 mg q3–5 min after 2nd shock; amiodarone 300 mg IV/IO after 3rd shock (then 150 mg).' });

  function vfGen(S, amp) {
    const comps = []; for (let i = 0; i < 6; i++) comps.push([S.r(3.2, 7), S.r(0.4, 1) * amp, S.r(0, 6.28)]);
    const m1 = S.r(0.15, 0.45), mp = S.r(0, 6.28);
    S.fn((t) => comps.reduce((v, [f, a, ph]) => v + a * Math.sin(2 * Math.PI * f * t + ph), 0) * (0.55 + 0.45 * Math.sin(2 * Math.PI * m1 * t + mp)) * 0.55);
  }

  // ===== LEVEL 2 =====
  add({ id: 'sarr', name: 'Sinus arrhythmia', level: 2, similar: ['nsr', 'wap', 'afib', 'pac'],
    gen: (S) => { const rr0 = 60 / S.r(58, 82), pr = S.r(0.14, 0.18), per = S.r(3.2, 4.8), ph = S.r(0, 6.28), d = S.r(0.18, 0.28); let t = -1.2; while (t < S.to) { const rr = rr0 * (1 + d * Math.sin(2 * Math.PI * t / per + ph)); S.beat(t, { pr, rr }); t += rr; } },
    why: ['Irregular rhythm with gradual, cyclic speeding and slowing (often with breathing)', 'R-R variation > 0.16 s, but every P looks the same', 'One upright P before each QRS, constant PR', 'Narrow QRS; a normal variant, especially in the young'],
    tx: 'None; it is a normal variant. Assess the patient.' });
  add({ id: 'pac', name: 'Sinus rhythm with PACs', level: 2, similar: ['pjc', 'pvc', 'sarr', 'arrest'],
    gen: (S) => { const a = S.ri(2, 4), b = a + S.ri(3, 4); ectopicSinus(S, S.r(64, 88), (i) => (i === a || i === b ? 'A' : 'N')); },
    why: ['Underlying sinus rhythm interrupted by an early beat', 'The early beat has a P wave that looks different from the sinus P', 'Narrow QRS (normal conduction)', 'Non-compensatory pause afterward (the sinus node is reset)'],
    tx: 'Usually none. Reduce triggers (caffeine, nicotine, stimulants, stress); check electrolytes if frequent.' });
  add({ id: 'pvc', name: 'Sinus rhythm with unifocal PVCs', level: 2, similar: ['pac', 'pjc', 'big', 'aivr'],
    gen: (S) => { const a = S.ri(2, 3), b = a + S.ri(3, 4); ectopicSinus(S, S.r(64, 88), (i) => (i === a || i === b ? 'V' : 'N')); },
    why: ['Underlying sinus rhythm with early beats', 'Early beats are wide (≥ 0.12 s) and bizarre, with no preceding P', 'T wave points opposite the QRS; all PVCs look alike (unifocal)', 'Full compensatory pause (sinus P keeps marching, hidden in the PVC)'],
    tx: 'Usually no antiarrhythmic. Assess the patient; correct K⁺/Mg²⁺, hypoxia, ischemia, and stimulant or drug effects.' });
  add({ id: 'junc', name: 'Junctional rhythm', level: 2, similar: ['sbrady', 'ajr', 'idio', 'chb'],
    gen: (S) => junctional(S, S.r(40, 59)),
    why: ['Regular rhythm at 40–60 bpm (intrinsic junctional rate)', 'P wave inverted before the QRS with short PR (< 0.12 s), hidden, or just after the QRS', 'Narrow QRS (impulse travels down the normal pathway)', 'An escape rhythm when the sinus node fails'],
    tx: 'If symptomatic: bradycardia algorithm (atropine 1 mg IV, pacing if needed). Look for cause: digoxin toxicity, inferior MI, AV nodal blockers.' });
  add({ id: 'afib', name: 'Atrial fibrillation (controlled rate)', level: 2, similar: ['afibrvr', 'mat', 'flutv', 'sarr'],
    gen: (S) => { fib(S, S.r(0.025, 0.06)); let t = -1.2; while (t < S.to) { const rr = S.r(0.52, 1.15); S.beat(t, { rr }); t += rr; } },
    why: ['Irregularly irregular R-R intervals with no pattern', 'No distinct P waves; wavy fibrillatory baseline', 'Narrow QRS', 'Ventricular rate < 100 bpm, so it is rate controlled'],
    tx: 'Continue rate control; assess stroke risk for anticoagulation (CHA₂DS₂-VASc). Treat symptoms/cause.' });
  add({ id: 'afibrvr', name: 'Atrial fibrillation with RVR', level: 2, similar: ['afib', 'mat', 'svt', 'flutv'],
    gen: (S) => { fib(S, S.r(0.025, 0.055)); let t = -1.2; while (t < S.to) { const rr = S.r(0.32, 0.6); S.beat(t, { rr, tAmp: S.tAmp * 0.8 }); t += rr; } },
    why: ['Irregularly irregular rhythm', 'No P waves; fibrillatory baseline', 'Narrow QRS', 'Ventricular rate > 100 bpm (rapid ventricular response)'],
    tx: 'Unstable: synchronized cardioversion (120–200 J biphasic). Stable: rate control (diltiazem 0.25 mg/kg IV or a beta-blocker); evaluate anticoagulation before rhythm conversion.' });
  add({ id: 'flut4', name: 'Atrial flutter (4:1)', level: 2, similar: ['flut2', 'flutv', 'afib', 'nsr'], rateMode: 'flutter',
    gen: (S) => flutter(S, 4),
    why: ['Sawtooth flutter (F) waves, best seen in II, III, aVF', 'Atrial rate around 300/min', 'Four flutter waves for every QRS, so ventricular rate ~75', 'Regular, narrow QRS'],
    tx: 'Usually rate controlled already. If unstable: synchronized cardioversion (50–100 J). Assess anticoagulation as for AFib.' });
  add({ id: 'first', name: 'First-degree AV block', level: 2, similar: ['nsr', 'wenck', 'sbrady', 'mobitz2'], rateMode: 'av',
    gen: (S) => sinus(S, S.r(58, 88), { pr: S.r(0.24, 0.34) }),
    why: ['Regular sinus rhythm', 'Every P is followed by a QRS (no dropped beats)', 'PR interval prolonged > 0.20 s and constant', 'Narrow QRS'],
    tx: 'Usually none. Monitor and review AV-nodal blocking drugs (beta-blockers, CCBs, digoxin).' });
  add({ id: 'svt', name: 'Supraventricular tachycardia (SVT)', level: 2, similar: ['stach', 'flut2', 'jtach', 'afibrvr'],
    gen: (S) => { const { times, rr } = run(S, S.r(165, 225), 0.004); times.forEach((q) => S.beat(q, { rr, tAmp: S.tAmp * 0.75 })); },
    why: ['Very regular narrow-complex tachycardia', 'Rate usually 150–250 bpm', 'P waves not visible (buried in QRS/T)', 'Abrupt onset/offset distinguishes it from sinus tachycardia'],
    tx: 'Stable: vagal maneuvers, then adenosine 6 mg rapid IV push with flush, then 12 mg. Unstable: synchronized cardioversion (50–100 J).' });
  add({ id: 'vt', name: 'Monomorphic ventricular tachycardia', level: 2, similar: ['tdp', 'svt', 'aivr', 'vfc'],
    gen: (S) => { S.A *= 1.05; const rr = ventricular(S, S.r(150, 210), 'vt'); if (S.rng() < 0.6) atrialP(S, S.r(70, 95)).forEach((t) => S.p(t, S.pAmp * 0.8)); return rr; },
    why: ['Regular, wide (> 0.12 s) complexes that all look the same', 'Rate typically 150–250 bpm', 'No P waves related to the QRS (AV dissociation)', 'Three or more PVCs in a row = VT'],
    tx: 'Pulseless: CPR + defibrillation. Pulse and unstable: synchronized cardioversion (100 J). Stable: amiodarone 150 mg IV over 10 min (repeat as needed), expert consult.' });
  add({ id: 'vffine', name: 'Ventricular fibrillation (fine)', level: 2, similar: ['asys', 'vfc', 'tdp'], rateMode: 'vf',
    gen: (S) => vfGen(S, S.r(0.13, 0.22)),
    why: ['Low-amplitude chaotic undulations', 'No organized P, QRS, or T', 'Can be mistaken for asystole, so increase gain and check another lead', 'Patient is pulseless'],
    tx: 'Shockable: CPR + defibrillation (biphasic 120–200 J); epinephrine 1 mg q3–5 min; amiodarone 300 mg after 3rd shock.' });
  add({ id: 'vpace', name: 'Ventricular paced rhythm', level: 2, similar: ['avpace', 'apace', 'idio', 'bbb'], rateMode: 'paced',
    gen: (S) => { const rate = S.pick([60, 65, 70, 72, 75, 80]); S.pacerRate = rate; const rr = 60 / rate; for (let t = S.r(-1, -0.2); t < S.to; t += rr) { S.spike(t - 0.01); S.qrs(t, 'paced'); } },
    why: ['Pacer spike immediately before each QRS', 'Wide QRS (ventricle depolarized from the lead tip, not the bundles)', 'Regular rate equal to the programmed rate', 'No paced P waves; each spike captures (1:1)'],
    tx: 'None. Normal pacemaker function; confirm a pulse with each complex (mechanical capture).' });

  // ===== LEVEL 3 =====
  add({ id: 'arrest', name: 'Sinus arrest / pause', level: 3, similar: ['sarr', 'pac', 'twoone', 'mobitz2'],
    gen: (S) => { const rr = 60 / S.r(64, 86), pr = S.r(0.14, 0.18), at = S.r(1.4, 2.6), gap = S.r(2.3, 3.1); let t = S.r(-1, -0.3), done = false; while (t < S.to) { S.beat(t, { pr, rr }); if (!done && t > at) { t += gap; done = true; } else t += rr; } },
    why: ['Underlying regular sinus rhythm', 'Sudden pause with no P wave and no QRS', 'Pause is not a multiple of the normal P-P interval (arrest rather than exit block)', 'Rhythm resumes with normal sinus beats'],
    tx: 'If symptomatic: bradycardia algorithm (atropine, pacing). Review drugs (beta-blockers, CCBs, digoxin); consider sick sinus syndrome workup.' });
  add({ id: 'big', name: 'Ventricular bigeminy', level: 3, similar: ['trig', 'couplet', 'pvc', 'pac'],
    gen: (S) => ectopicSinus(S, S.r(78, 100), (i) => (i % 2 ? 'V' : 'N')),
    why: ['Every other beat is a PVC (normal, PVC, normal, PVC…)', 'PVCs are wide and bizarre with no preceding P', 'Normal beats have P waves and narrow QRS', 'Pattern of grouped pairs; pulse may feel slow if PVCs perfuse poorly'],
    tx: 'Assess the patient; correct K⁺/Mg²⁺, ischemia, hypoxia, and digoxin or stimulant toxicity. Antiarrhythmics only if symptomatic/expert advised.' });
  add({ id: 'trig', name: 'Ventricular trigeminy', level: 3, similar: ['big', 'couplet', 'pvc', 'pac'],
    gen: (S) => ectopicSinus(S, S.r(72, 96), (i) => (i % 3 === 2 ? 'V' : 'N')),
    why: ['Every third beat is a PVC (normal, normal, PVC)', 'PVCs are wide, bizarre, with no P and discordant T', 'Normal beats are sinus with narrow QRS', 'Compensatory pause after each PVC'],
    tx: 'Treat the cause: electrolytes (K⁺, Mg²⁺), ischemia, hypoxia, drugs. Usually no antiarrhythmic.' });
  add({ id: 'couplet', name: 'Sinus rhythm with PVC couplet', level: 3, similar: ['vt', 'big', 'pvc', 'trig'],
    gen: (S) => { const a = S.ri(2, 4); ectopicSinus(S, S.r(64, 84), (i) => (i === a ? 'V2' : 'N')); },
    why: ['Sinus rhythm interrupted by two consecutive PVCs', 'Both ectopic beats are wide and bizarre without P waves', 'Two PVCs in a row = couplet; three or more = VT', 'Pause follows before sinus rhythm resumes'],
    tx: 'Assess the patient; correct electrolytes and ischemia. Frequent couplets warrant closer monitoring and evaluation (risk of VT).' });
  add({ id: 'pjc', name: 'Sinus rhythm with PJCs', level: 3, similar: ['pac', 'pvc', 'junc', 'arrest'],
    gen: (S) => { const a = S.ri(2, 4), b = a + S.ri(3, 4); ectopicSinus(S, S.r(64, 86), (i) => (i === a || i === b ? 'J' : 'N')); },
    why: ['Sinus rhythm with an early beat', 'Early beat has a narrow QRS', 'P wave of the early beat is inverted with a short PR, or absent', 'Usually a non-compensatory pause'],
    tx: 'Usually none. Check for digoxin toxicity, stimulants, ischemia if frequent.' });
  add({ id: 'ajr', name: 'Accelerated junctional rhythm', level: 3, similar: ['junc', 'jtach', 'nsr', 'aivr'],
    gen: (S) => junctional(S, S.r(64, 98)),
    why: ['Regular rhythm at 60–100 bpm', 'Faster than the 40–60 junctional escape rate', 'Inverted P with short PR, absent P, or retrograde P after QRS', 'Narrow QRS'],
    tx: 'Usually well tolerated: monitor and treat the cause (digoxin toxicity, ischemia/inferior MI, post-cardiac surgery, myocarditis).' });
  add({ id: 'jtach', name: 'Junctional tachycardia', level: 3, similar: ['svt', 'stach', 'ajr', 'flut2'],
    gen: (S) => junctional(S, S.r(105, 145)),
    why: ['Regular narrow-complex rhythm > 100 bpm', 'P waves inverted (short PR), hidden, or after the QRS', 'Arises from the AV junction', 'Rate usually slower than typical reentrant SVT'],
    tx: 'Treat the cause (digoxin toxicity, ischemia, post-op). If stable, rate control/expert consult; unstable: synchronized cardioversion per tachycardia algorithm (often less effective).' });
  add({ id: 'flut2', name: 'Atrial flutter (2:1)', level: 3, similar: ['svt', 'stach', 'flut4', 'jtach'], rateMode: 'flutter',
    gen: (S) => flutter(S, 2),
    why: ['Regular narrow-complex tachycardia, ventricular rate ~150', 'Every other flutter wave is buried in the QRS or T', 'Look for sawtooth F waves between beats (atrial rate ~300)', 'Think 2:1 flutter whenever a regular rate sits right at 150'],
    tx: 'Unstable: synchronized cardioversion (50–100 J). Stable: rate control (diltiazem or beta-blocker); assess anticoagulation.' });
  add({ id: 'flutv', name: 'Atrial flutter (variable block)', level: 3, similar: ['afib', 'flut4', 'mat', 'flut2'], rateMode: 'flutter',
    gen: (S) => flutter(S, [2, 3, 4, 4, 2]),
    why: ['Sawtooth flutter waves at ~300/min', 'Conduction ratio changes (2:1, 3:1, 4:1)', 'Irregular ventricular rhythm, but R-R intervals are multiples of the flutter cycle', 'Narrow QRS; discrete F waves (not fibrillatory) distinguish it from AFib'],
    tx: 'Rate control if stable (diltiazem/beta-blocker); synchronized cardioversion (50–100 J) if unstable; anticoagulation assessment.' });
  add({ id: 'wenck', name: 'Second-degree AV block, type I (Wenckebach)', level: 3, similar: ['mobitz2', 'first', 'twoone', 'pac'], rateMode: 'av',
    gen: (S) => { const n = S.pick([3, 4, 4, 5]), prs = { 3: [0.17, 0.3], 4: [0.16, 0.26, 0.32], 5: [0.16, 0.25, 0.31, 0.35] }[n]; const ps = atrialP(S, S.r(72, 92)); let k = S.ri(0, n - 1); ps.forEach((t) => { const j = k % n; if (j < n - 1) S.beat(t + prs[j], { pr: prs[j], rr: 0.85 }); else S.p(t); k++; }); },
    why: ['P waves regular; some are not followed by a QRS', 'PR progressively lengthens until a P is dropped', 'R-R intervals shorten across the group, giving grouped beating', 'PR after the dropped beat is the shortest; QRS usually narrow'],
    tx: 'Usually benign (AV nodal): monitor. If symptomatic: atropine 1 mg IV, then pacing if needed. Review AV-nodal drugs.' });
  add({ id: 'idio', name: 'Idioventricular rhythm', level: 3, similar: ['aivr', 'chb', 'junc', 'vpace'],
    gen: (S) => { S.from = -2.6; ventricular(S, S.r(24, 39)); },
    why: ['Wide, bizarre QRS (≥ 0.12 s)', 'Slow rate 20–40 bpm', 'No P waves associated with the QRS', 'Ventricular escape: the last-resort pacemaker'],
    tx: 'With a pulse and symptoms: bradycardia algorithm (atropine, transcutaneous pacing). Do NOT suppress with antiarrhythmics. Pulseless: treat as PEA (CPR, epinephrine).' });
  add({ id: 'aivr', name: 'Accelerated idioventricular rhythm (AIVR)', level: 3, similar: ['idio', 'vt', 'ajr', 'vpace'],
    gen: (S) => ventricular(S, S.r(50, 98)),
    why: ['Wide, bizarre QRS with no related P waves', 'Regular rate 40–100 bpm (between idioventricular and VT)', 'Common after reperfusion of an MI', 'Usually self-limited and benign'],
    tx: 'Usually none: monitor (classic reperfusion rhythm). Do not suppress with antiarrhythmics; treat symptoms/ischemia.' });
  add({ id: 'apace', name: 'Atrial paced rhythm', level: 3, similar: ['vpace', 'avpace', 'nsr', 'first'], rateMode: 'paced',
    gen: (S) => { const rate = S.pick([60, 65, 70, 75, 80]); S.pacerRate = rate; const rr = 60 / rate, pr = S.r(0.16, 0.22); for (let t = S.r(-1, -0.2); t < S.to; t += rr) { S.spike(t - pr, 0.9); S.beat(t, { pr, rr, pShape: 'flat' }); } },
    why: ['Pacer spike precedes each P wave', 'P then conducts normally down the AV node', 'Narrow QRS (native conduction)', 'Regular rate at the programmed rate'],
    tx: 'None. Normal pacemaker function.' });
  add({ id: 'avpace', name: 'AV sequential (dual-chamber) paced rhythm', level: 3, similar: ['vpace', 'apace', 'bbb', 'idio'], rateMode: 'paced',
    gen: (S) => { const rate = S.pick([60, 65, 70, 75]); S.pacerRate = rate; const rr = 60 / rate, av = S.r(0.15, 0.2); for (let t = S.r(-1, -0.2); t < S.to; t += rr) { S.spike(t - av, 0.9); S.p(t - av, S.pAmp * 0.8, 'flat'); S.spike(t - 0.01); S.qrs(t, 'paced'); } },
    why: ['Two pacer spikes per beat', 'First spike captures the atria (small P)', 'Second spike after a fixed AV delay captures the ventricles', 'Wide paced QRS at a regular programmed rate'],
    tx: 'None. Normal dual-chamber pacemaker function.' });
  add({ id: 'bbb', name: 'Sinus rhythm with bundle branch block', level: 3, similar: ['nsr', 'aivr', 'vpace', 'first'],
    gen: (S) => sinus(S, S.r(62, 92), { beat: { kind: 'bbb' } }),
    why: ['Regular sinus rhythm: upright P before every QRS, normal PR', 'QRS wide (≥ 0.12 s), often notched/slurred', 'T wave opposite the main QRS direction (secondary repolarization change)', 'Get a 12-lead to classify right vs left BBB (V1/V6)'],
    tx: 'No rhythm-specific treatment. Get a 12-lead; a new LBBB with chest pain needs ACS evaluation.' });
  add({ id: 'pea', name: 'Pulseless electrical activity (PEA)', level: 3, similar: ['nsr', 'sbrady', 'idio', 'asys'],
    scenario: 'The patient is unresponsive with no palpable pulse.',
    gen: (S) => { S.A *= 0.75; const rate = S.r(48, 85); if (S.rng() < 0.5) sinus(S, rate); else junctional(S, rate); },
    why: ['An organized rhythm is on the monitor…', '…but the patient has no pulse; that combination is PEA', 'PEA is a clinical diagnosis: always check a pulse, not just the monitor', 'Search for the reversible cause (H’s & T’s)'],
    tx: 'Non-shockable: CPR, epinephrine 1 mg IV/IO ASAP then q3–5 min; treat H’s & T’s (hypovolemia, hypoxia, H⁺, K⁺, hypothermia, tension pneumo, tamponade, toxins, thrombosis).' });

  // ===== LEVEL 4 =====
  add({ id: 'mobitz2', name: 'Second-degree AV block, type II (Mobitz II)', level: 4, similar: ['wenck', 'twoone', 'chb', 'arrest'], rateMode: 'av',
    gen: (S) => { const n = S.pick([3, 4, 4, 5]), pr = S.r(0.15, 0.2), kind = S.rng() < 0.55 ? 'bbb' : 'narrow'; const ps = atrialP(S, S.r(70, 92)); let k = S.ri(0, n - 1); ps.forEach((t) => { if (k % n !== n - 1) S.beat(t + pr, { pr, rr: 0.8, kind }); else S.p(t); k++; }); },
    why: ['P waves regular; occasional P not followed by a QRS', 'PR constant in all conducted beats (no lengthening)', 'Block is below the AV node; QRS often wide', 'Can progress suddenly to complete heart block'],
    tx: 'Prepare transcutaneous pacing (atropine often ineffective for infranodal block); dopamine/epinephrine infusion as bridge; needs transvenous/permanent pacemaker.' });
  add({ id: 'twoone', name: 'Second-degree AV block, 2:1 conduction', level: 4, similar: ['wenck', 'mobitz2', 'sbrady', 'chb'], rateMode: 'av',
    gen: (S) => { const pr = S.r(0.16, 0.24); const ps = atrialP(S, S.r(76, 104)); let k = S.ri(0, 1); ps.forEach((t) => { if (k % 2 === 0) S.beat(t + pr, { pr, rr: 1.3 }); else S.p(t); k++; }); },
    why: ['Two P waves for every QRS', 'Atrial rate regular; ventricular rate exactly half', 'PR constant for conducted beats', 'Cannot tell type I vs II from the strip alone (no two consecutive PRs to compare)'],
    tx: 'If symptomatic: atropine 1 mg IV and prepare pacing; wide QRS suggests infranodal block, so pace early. Expert consult.' });
  add({ id: 'chb', name: 'Third-degree (complete) AV block', level: 4, similar: ['twoone', 'mobitz2', 'idio', 'wenck'], rateMode: 'av',
    gen: (S) => { S.from = -2.6; atrialP(S, S.r(66, 96)).forEach((t) => S.p(t)); if (S.rng() < 0.5) { const { times, rr } = run(S, S.r(40, 52), 0.01); times.forEach((q) => S.beat(q, { rr })); } else ventricular(S, S.r(28, 40)); },
    why: ['P waves regular and QRS regular, but they are unrelated (AV dissociation)', 'PR intervals vary randomly; P waves march through QRS and T waves', 'Atrial rate faster than ventricular rate', 'Escape is junctional (narrow, 40–60) or ventricular (wide, 20–40)'],
    tx: 'Symptomatic: transcutaneous pacing (don’t delay for atropine; it’s often ineffective); dopamine/epinephrine infusion as bridge; transvenous pacing + expert consult.' });
  add({ id: 'mat', name: 'Multifocal atrial tachycardia (MAT)', level: 4, similar: ['afibrvr', 'wap', 'stach', 'flutv'],
    gen: (S) => { const shapes = ['normal', 'peaked', 'inverted', 'biphasic', 'notched']; let t = -1.2; while (t < S.to) { const rr = S.r(0.42, 0.62); S.beat(t, { rr, pr: S.r(0.11, 0.2), pShape: S.pick(shapes), pAmp: S.pAmp * S.r(0.8, 1.2) }); t += rr; } },
    why: ['Irregular rhythm, rate > 100 bpm', 'Distinct P waves present, but at least 3 different P shapes', 'PR intervals vary', 'Classic with COPD/hypoxia; distinct P waves distinguish it from AFib'],
    tx: 'Treat the cause (hypoxia, COPD exacerbation, electrolytes; give Mg²⁺/K⁺). Cardioversion is ineffective; rate control (CCB/beta-blocker) if needed.' });
  add({ id: 'wap', name: 'Wandering atrial pacemaker', level: 4, similar: ['mat', 'sarr', 'pac', 'afib'],
    gen: (S) => { const shapes = ['normal', 'normal', 'peaked', 'flat', 'inverted', 'biphasic', 'notched']; let t = -1.2, i = 0, sh = 'normal'; while (t < S.to) { if (i % 2 === 0) sh = S.pick(shapes); const rr = S.r(0.72, 1.05); S.beat(t, { rr, pr: S.r(0.12, 0.2), pShape: sh }); t += rr; i++; } },
    why: ['Rate < 100 bpm (same idea as MAT but slower)', 'At least 3 different P-wave shapes as the pacemaker wanders', 'PR intervals vary; slight irregularity', 'Narrow QRS'],
    tx: 'Usually none. Treat underlying cause (lung disease, vagal tone, digoxin) if present.' });
  add({ id: 'tdp', name: 'Polymorphic VT (torsades de pointes)', level: 4, similar: ['vfc', 'vt', 'vffine'], rateMode: 'tdp',
    gen: (S) => { const rr = 60 / S.r(200, 250), per = S.r(1.8, 2.6), ph = S.r(0, per); for (let t = -1; t < S.to; t += rr * S.r(0.94, 1.06)) { const env = Math.sin(Math.PI * (t - ph) / per); S.qrs(t, 'vt', S.A * (0.2 + 1.05 * Math.abs(env)), env >= 0 ? 1 : -1); } },
    why: ['Wide complexes at 200–250 bpm', 'QRS amplitude and polarity change, "twisting" around the baseline', 'Spindle-shaped groups of beats', 'Associated with long QT (drugs, low K⁺/Mg²⁺)'],
    tx: 'Magnesium sulfate 1–2 g IV. Pulseless: defibrillate (unsynchronized) + CPR. Stop QT-prolonging drugs; correct K⁺; consider overdrive pacing/isoproterenol.' });
  add({ id: 'ftc', name: 'Pacemaker failure to capture', level: 4, similar: ['fts', 'vpace', 'chb', 'arrest'], rateMode: 'paced',
    gen: (S) => { const rate = S.pick([60, 65, 70, 72]); S.pacerRate = rate; const rr = 60 / rate; let i = 0, fails = 0; const failAt = new Set([2, S.ri(5, 6), S.rng() < 0.5 ? 8 : -1]); for (let t = S.r(-0.5, -0.1); t < S.to; t += rr, i++) { S.spike(t - 0.01); if (failAt.has(i) || (S.rng() < 0.12 && i > 2 && !failAt.has(i - 1))) { fails++; } else S.qrs(t, 'paced'); } },
    why: ['Pacer spikes occur at the programmed rate…', '…but some spikes are not followed by a QRS (no capture)', 'Resulting pauses lower the ventricular rate', 'Causes: lead dislodgement, high threshold, battery, electrolytes, ischemia'],
    tx: 'Assess perfusion; increase pacer output (mA), check connections/lead and patient position; transcutaneous pacing backup; atropine if symptomatic bradycardia. Device interrogation.' });
  add({ id: 'fts', name: 'Pacemaker failure to sense (undersensing)', level: 4, similar: ['ftc', 'vpace', 'pvc', 'avpace'], rateMode: 'paced',
    gen: (S) => { const rr = 60 / S.r(76, 92), pr = S.r(0.14, 0.18), prate = S.pick([50, 55, 60]); S.pacerRate = prate; const prr = 60 / prate; const ev = []; for (let t = S.r(-1.2, -0.4); t < S.to; t += rr) ev.push([t, 'n']); for (let t = S.r(-0.8, 0.2); t < S.to; t += prr) ev.push([t, 's']); ev.sort((a, b) => a[0] - b[0]); let lastV = -9; for (const [t, k] of ev) { if (k === 'n') { if (t - lastV < 0.3) S.p(t - pr); else { S.beat(t, { pr, rr }); lastV = t; } } else { S.spike(t); if (t - lastV > 0.36) { S.qrs(t + 0.01, 'paced'); lastV = t; } } } },
    why: ['Native beats occur, yet the pacer keeps firing anyway', 'Spikes fall at inappropriate places: right after QRSs or on T waves', 'Spikes in the refractory period do not capture; others produce paced beats', 'Danger: spike on T (R-on-T) can trigger VT/VF'],
    tx: 'Increase sensitivity (lower the mV setting), check lead position/connections, correct electrolytes; turn off/interrogate device per expert. Treat VT/VF if it occurs.' });

  global.RHYTHMS = R;
})(window);
