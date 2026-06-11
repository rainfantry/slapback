// =====================================================================
// pitchMath.js — TINY PURE HELPERS FOR THE PITCH LAYER
// ---------------------------------------------------------------------
// PLAIN ENGLISH:
// These are small, self-contained sums. Each one takes numbers in and
// gives numbers out — no audio, no screen, no memory of the past. That
// makes them the easiest things in the app to read and trust. Each has
// ONE job, named plainly.
// =====================================================================

// The twelve note names in one octave, starting at C (the standard order).
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// hzToNote(freq): turn a raw frequency (vibrations per second) into the
// nearest musical note plus how far off it is, in "cents".
//   - "A4" is the note A above middle C, defined as exactly 440 Hz.
//   - 100 cents = one semitone (one piano key). +50 cents = halfway sharp.
// Returns e.g. { note: "A4", cents: +5 }  (positive = sharp, negative = flat).
export function hzToNote(freq) {
  // This formula is the standard music-to-number conversion. It tells us how
  // many semitones above/below A4 the frequency is, as a decimal "MIDI" number.
  const midi = 69 + 12 * Math.log2(freq / 440);   // 69 is the MIDI number of A4
  const rounded = Math.round(midi);                // the nearest whole note
  // How far the real pitch sits from that nearest note, in cents (-50..+50).
  const cents = Math.round((midi - rounded) * 100);
  // Pick the note name. The "((x % 12) + 12) % 12" trick keeps it 0..11 even
  // for negative numbers (so very low notes don't break it).
  const name = NOTE_NAMES[((rounded % 12) + 12) % 12];
  // Which octave (how high overall). The "-1" matches standard music numbering.
  const octave = Math.floor(rounded / 12) - 1;
  return { note: `${name}${octave}`, cents };
}

// isSilent(level): is the sound too quiet to bother detecting a note?
// "level" is loudness from 0 (silence) to ~1 (loud). Default cutoff 0.02.
export function isSilent(level, threshold = 0.02) {
  return level < threshold;
}

// isInTune(cents): are we close enough to perfect to call it "in tune"?
// Within ±5 cents by default (a difference the ear barely notices).
export function isInTune(cents, tolerance = 5) {
  return Math.abs(cents) <= tolerance;
}

// smoothCents(previous, target): ease a value gently toward a new one instead
// of snapping. This is what stops the tuner needle from twitching on every
// noisy reading. "factor" 0.25 = move a quarter of the way each step.
export function smoothCents(previous, target, factor = 0.25) {
  return previous + (target - previous) * factor;
}

// centsToFraction(cents): map the -50..+50 cents range onto 0..1, so the
// needle code can place itself from the far left (0) to the far right (1),
// with dead-centre (0.5) meaning perfectly in tune. Clamped so it never
// runs off the ends.
export function centsToFraction(cents) {
  const clamped = Math.max(-50, Math.min(50, cents));
  return (clamped + 50) / 100;
}
