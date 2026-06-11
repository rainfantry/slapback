// =====================================================================
// pitchSource.js — THE PITCH BOUNDARY (the only file wired to the detector)
// ---------------------------------------------------------------------
// PLAIN ENGLISH:
// This is the pitch-layer twin of audioEngine.js. Just like the audio
// engine is the only file that touches the speaker, THIS is the only
// file that runs the note detector. The rest of the app just calls
// start / stop / subscribe and never cares how notes are found.
//
// How it works:
//   The audio engine already opened the mic and gave us a "listening tap"
//   (an analyser). About 30 times a second we ask that tap for the latest
//   slice of sound wave, then:
//     1. measure how LOUD it is (so we can hide the note when silent),
//     2. run a "pitch detector" (YIN) to find the FREQUENCY being sung,
//     3. turn that frequency into a NOTE + how sharp/flat (cents),
//     4. shrink the wave down to a few points for drawing,
//   and hand all of that to whoever subscribed (the usePitch hook).
//
// IMPORTANT: this file NEVER opens the mic and NEVER changes what you
// hear. It only listens to the tap the audio engine already created.
// =====================================================================

// YIN is a well-known, accurate note-detection method for a single voice.
import { YIN } from 'pitchfinder';
// We read the mic "tap" from the audio engine (one-way: we use it, it
// doesn't use us — so there's no tangle).
import audioEngine from './audioEngine';
// Our pure helper that converts a frequency into a note + cents.
import { hzToNote } from '../pitch/pitchMath';

// --- FIXED SETTINGS --------------------------------------------------
const SAMPLE_RATE = 48000;     // must match the engine's 48,000 samples/sec
const FFT_SIZE = 2048;         // how many samples the tap hands us each time
const WAVE_POINTS = 128;       // how many points we keep for drawing the wave
const TICK_MS = 33;            // run ~30 times a second (1000ms / 33 ≈ 30)
const SILENCE_LEVEL = 0.01;    // below this loudness = treat as silence
const MIN_HZ = 70;             // ignore anything below ~70 Hz (rumble)
const MAX_HZ = 1100;           // ignore anything above ~1100 Hz (out of voice range)

// Build the detector once. It needs to know the sample rate to do its maths.
const detectPitch = YIN({ sampleRate: SAMPLE_RATE, threshold: 0.1 });

// --- PRIVATE MEMORY --------------------------------------------------
let analyser = null;                       // the mic "tap" from the engine
let timer = null;                          // the ~30Hz repeating clock
let subscriber = null;                     // the one function we report to
const buf = new Float32Array(FFT_SIZE);    // reusable bucket for sample data

// tick(): one pass — read the sound, find the note, report it.
function tick() {
  if (!analyser) return;                   // tap gone? do nothing this pass.

  // 1) Fill our bucket with the latest slice of the live sound wave.
  analyser.getFloatTimeDomainData(buf);

  // 2) Measure loudness as RMS (root-mean-square): square every sample,
  //    average them, square-root the result. A standard "how loud" number.
  let sum = 0;
  for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
  const level = Math.sqrt(sum / buf.length);

  // 3) Shrink the 2048-sample wave down to WAVE_POINTS points for drawing
  //    (we don't need every sample to draw a recognisable wiggle).
  const step = Math.floor(buf.length / WAVE_POINTS);
  const waveform = new Array(WAVE_POINTS);
  for (let i = 0; i < WAVE_POINTS; i++) waveform[i] = buf[i * step];

  // 4) Find the note — but only if there's enough sound to bother.
  let note = '';        // '' means "no clear note"
  let frequency = 0;
  let cents = 0;
  if (level > SILENCE_LEVEL) {
    const hz = detectPitch(buf);                 // a frequency, or null
    if (hz && hz >= MIN_HZ && hz <= MAX_HZ) {    // sane, in-voice-range?
      const result = hzToNote(hz);
      note = result.note;
      cents = result.cents;
      frequency = hz;
    }
  }

  // 5) Report everything to whoever is listening (the usePitch hook).
  if (subscriber) subscriber({ note, frequency, cents, level, waveform });
}

// start(): begin reporting readings. Call ONLY when the monitor is running,
// because that's when the mic (and therefore the tap) actually exists.
async function start() {
  analyser = audioEngine.getAnalyser();    // grab the tap the engine made
  if (!analyser) return;                   // no tap = monitor isn't running
  if (timer) clearInterval(timer);         // never run two clocks at once
  timer = setInterval(tick, TICK_MS);      // start the ~30Hz loop
}

// stop(): stop reporting and let go of the tap. Safe to call twice.
async function stop() {
  if (timer) clearInterval(timer);
  timer = null;
  analyser = null;
}

// subscribe(callback): register the ONE function that wants the readings.
// Returns a little "unsubscribe" function you can call to stop listening.
function subscribe(callback) {
  subscriber = callback;
  return () => { if (subscriber === callback) subscriber = null; };
}

export default { start, stop, subscribe };
