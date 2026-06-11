// =====================================================================
// pitchSource.js — THE PITCH BOUNDARY (the only file wired to the detector)
// ---------------------------------------------------------------------
// PLAIN ENGLISH:
// This is the pitch-layer twin of audioEngine.js. It is the only file that
// figures out what NOTE you're singing. The rest of the app just calls
// start / stop / subscribe and never cares how notes are found.
//
// How it works, ~30 times a second:
//   The audio engine already opened the mic and gave us a "listening tap"
//   (an analyser). Each pass we ask that tap for the latest slice of sound
//   and:
//     1. measure how LOUD it is (to hide the note when silent),
//     2. shrink the wave to a few points for drawing,
//     3. (about every 3rd pass, to spare the phone) find the NOTE using a
//        hand-written "autocorrelation" detector — see findPitch() below,
//     4. hand all of that to whoever subscribed (the usePitch hook).
//
// We detect the note only every 3rd pass on purpose: pitch detection is the
// expensive part, and doing it 30x/sec starves the screen so it can't draw
// (that was the "waveform only shows on stop" bug). 10x/sec is plenty for
// the eye and leaves the phone room to paint.
//
// IMPORTANT: this file NEVER opens the mic and NEVER changes what you hear.
// =====================================================================

import audioEngine from './audioEngine';
import { hzToNote } from '../pitch/pitchMath';

// --- FIXED SETTINGS --------------------------------------------------
const SAMPLE_RATE = 48000;     // must match the engine's 48,000 samples/sec
const FFT_SIZE = 2048;         // how many samples the tap hands us each time
const WAVE_POINTS = 64;        // points kept for drawing the wave (fewer = lighter)
const TICK_MS = 33;            // run ~30 times a second
const DETECT_EVERY = 3;        // but only DETECT the note every 3rd pass (~10Hz)
const SILENCE_LEVEL = 0.02;    // below this loudness = treat as silence
const MIN_HZ = 70;             // lowest note we look for (~70 Hz, low male voice)
const MAX_HZ = 1000;           // highest note we look for (~1000 Hz, high voice)
const CLARITY = 0.80;          // how "sure" the detector must be to report a note

// DOWNSAMPLING: voice notes are low, so we shrink the sound 4x (to 12,000/sec)
// before detecting. Cheaper to process and focuses on the voice range.
const DOWNSAMPLE = 4;
const DS_RATE = SAMPLE_RATE / DOWNSAMPLE;            // 12,000 samples/sec
const dsBuf = new Float32Array(FFT_SIZE / DOWNSAMPLE); // 512 shrunk samples

// --- PRIVATE MEMORY --------------------------------------------------
let analyser = null;                       // the mic "tap" from the engine
let timer = null;                          // the ~30Hz repeating clock
let subscriber = null;                     // the one function we report to
const buf = new Float32Array(FFT_SIZE);    // reusable bucket for sample data

// Remember the last detected note between detection passes, so the note stays
// steady on the 2 out of 3 passes where we skip detection.
let lastNote = '';
let lastCents = 0;
let lastFreq = 0;

// Diagnostics / pacing counters.
let tickN = 0;
let lastRawHz = null;
let lastClarity = 0;

// findPitch(samples, rate): the note detector, written by hand.
// PLAIN ENGLISH: a note is a wave that repeats. We slide a copy of the sound
// over itself and find the shift ("lag") where it lines up best with itself —
// that shift IS the length of one repeat, which tells us the frequency. We
// only check shifts inside the voice range, so it can't return nonsense.
function findPitch(samples, rate) {
  const n = samples.length;

  // Remove any constant offset (centre the wave on zero) for a clean compare.
  let mean = 0;
  for (let i = 0; i < n; i++) mean += samples[i];
  mean /= n;

  // The shift range that corresponds to MIN_HZ..MAX_HZ.
  const minLag = Math.max(1, Math.floor(rate / MAX_HZ));   // small shift = high note
  const maxLag = Math.min(n - 1, Math.ceil(rate / MIN_HZ)); // big shift = low note

  let bestLag = -1;
  let bestCorr = 0;

  // Try each shift; score how well the wave lines up with itself at that shift.
  for (let lag = minLag; lag <= maxLag; lag++) {
    let corr = 0, energyA = 0, energyB = 0;
    for (let i = 0; i + lag < n; i++) {
      const a = samples[i] - mean;
      const b = samples[i + lag] - mean;
      corr += a * b;
      energyA += a * a;
      energyB += b * b;
    }
    // Normalise to 0..1 so the score is "how aligned" regardless of loudness.
    const score = corr / (Math.sqrt(energyA * energyB) + 1e-9);
    if (score > bestCorr) {
      bestCorr = score;
      bestLag = lag;
    }
  }

  // Only trust it if the best alignment is strong enough (a clear note).
  const hz = bestLag > 0 && bestCorr >= CLARITY ? rate / bestLag : null;
  return { hz, clarity: bestCorr };
}

// tick(): one pass — read the sound, maybe find the note, report it.
function tick() {
  if (!analyser) return;

  // 1) Latest slice of the live sound wave.
  analyser.getFloatTimeDomainData(buf);

  // 2) Loudness (RMS).
  let sum = 0;
  for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
  const level = Math.sqrt(sum / buf.length);

  // 3) Shrink the wave to WAVE_POINTS points for drawing (cheap decimation).
  const step = Math.floor(buf.length / WAVE_POINTS);
  const waveform = new Array(WAVE_POINTS);
  for (let i = 0; i < WAVE_POINTS; i++) waveform[i] = buf[i * step];

  // 4) Detect the note — but only every DETECT_EVERY passes, to spare the CPU.
  tickN++;
  if (tickN % DETECT_EVERY === 0) {
    if (level > SILENCE_LEVEL) {
      // Downsample (average each group of 4 samples) into dsBuf.
      for (let i = 0; i < dsBuf.length; i++) {
        let s = 0;
        for (let j = 0; j < DOWNSAMPLE; j++) s += buf[i * DOWNSAMPLE + j];
        dsBuf[i] = s / DOWNSAMPLE;
      }
      const r = findPitch(dsBuf, DS_RATE);
      lastRawHz = r.hz;
      lastClarity = r.clarity;
      if (r.hz) {
        const nn = hzToNote(r.hz);
        lastNote = nn.note;
        lastCents = nn.cents;
        lastFreq = r.hz;
      } else {
        lastNote = ''; lastCents = 0; lastFreq = 0;
      }
    } else {
      lastNote = ''; lastCents = 0; lastFreq = 0; lastRawHz = null; lastClarity = 0;
    }
  }

  // 5) Report to the usePitch hook (waveform every pass; note held between detects).
  if (subscriber) {
    subscriber({ note: lastNote, frequency: lastFreq, cents: lastCents, level, waveform });
  }
}

// start(): begin reporting. Call ONLY when the monitor is running.
async function start() {
  analyser = audioEngine.getAnalyser();
  if (!analyser) return;
  if (timer) clearInterval(timer);
  tickN = 0;
  timer = setInterval(tick, TICK_MS);
}

// stop(): stop reporting and let go of the tap. Safe to call twice.
async function stop() {
  if (timer) clearInterval(timer);
  timer = null;
  analyser = null;
  lastNote = ''; lastCents = 0; lastFreq = 0; lastRawHz = null; lastClarity = 0;
}

// subscribe(callback): register the ONE function that wants the readings.
function subscribe(callback) {
  subscriber = callback;
  return () => { if (subscriber === callback) subscriber = null; };
}

export default { start, stop, subscribe };
