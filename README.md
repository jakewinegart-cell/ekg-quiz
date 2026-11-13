# EKG Strip Quiz (prototype)

Static, offline, no build step. Open `index.html` via any static server (`python3 -m http.server`).

- `synth.js`: waveform synthesizer (Gaussian P/QRS/T, flutter/fib/VF baselines, pacer spikes) and SVG renderer on ECG paper (25 mm/s, 10 mm/mV).
- `rhythms.js`: 41 rhythm generators with rationale and first-line intervention text.
- `app.js`: quiz (82 strips = 2 seeded variants per rhythm, simple→complex, shuffle, swipe/Next/arrow keys, live score).
- `gallery.html`: review page showing every strip with measured rates.

Educational prototype; not medical advice.
