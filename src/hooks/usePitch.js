// =====================================================================
// usePitch.js — THE MIDDLEMAN FOR THE PITCH LAYER
// ---------------------------------------------------------------------
// PLAIN ENGLISH:
// This hook is the pitch-layer twin of useDelayMonitor. It connects the
// note detector (pitchSource) to the screen, and does the careful bit:
// readings arrive ~30 times a second, but re-drawing the whole screen 30
// times a second would make it stutter. So we split the data in two:
//
//   • FAST, no-redraw data (the raw wave, the loudness) is stashed in
//     "refs" — boxes React does NOT watch — so updating them is free.
//   • SLOW, visible data (the note text + needle position) is allowed to
//     update the screen only ~12 times a second, which is plenty smooth
//     for the eye and keeps everything buttery.
//
// It also starts the detector only while the monitor is running, and
// shuts it down the instant monitoring stops.
// =====================================================================

import { useState, useRef, useEffect, useCallback } from 'react';
import pitchSource from '../audio/pitchSource';
import { smoothCents, isInTune } from '../pitch/pitchMath';

// "status" comes from the monitor: 'idle' | 'starting' | 'running' | 'error'.
export default function usePitch(status) {
  // --- VISIBLE STATE (allowed to redraw the screen, but throttled) ----
  const [note, setNote] = useState('');     // the note text, e.g. "A4"
  const [cents, setCents] = useState(0);    // smoothed sharp/flat amount
  const [inTune, setInTune] = useState(false); // are we bang on?

  // --- FAST REFS (updated every tick, never redraw on their own) -------
  const waveformRef = useRef([]);           // latest wave points (for drawing)
  const levelRef = useRef(0);               // latest loudness
  const smoothRef = useRef(0);              // running smoothed cents value
  const lastTextAt = useRef(0);             // when we last updated the text

  // onReading: called ~30x/sec by pitchSource with a fresh reading.
  const onReading = useCallback((r) => {
    // Cheap every-tick work: stash the wave + loudness in refs (no redraw).
    waveformRef.current = r.waveform;
    levelRef.current = r.level;

    // Gently ease the needle value toward the new reading (calm, no twitch).
    // When there's no note, drift back toward centre (0).
    smoothRef.current = smoothCents(smoothRef.current, r.note ? r.cents : 0);

    // Throttle gate: let the VISIBLE values through at most ~12x/second.
    const now = Date.now();
    if (now - lastTextAt.current >= 80) {     // 80ms ≈ 12 times a second
      lastTextAt.current = now;
      setNote(r.note);
      setCents(Math.round(smoothRef.current));
      setInTune(r.note ? isInTune(r.cents) : false);
    }
  }, []);

  // Start the detector while running; stop + reset everything otherwise.
  useEffect(() => {
    if (status !== 'running') return;         // only run while monitoring

    const unsubscribe = pitchSource.subscribe(onReading); // listen
    pitchSource.start();                                   // begin readings

    // Cleanup runs when monitoring stops or the screen goes away.
    return () => {
      pitchSource.stop();
      unsubscribe();
      // Reset so the next session starts blank.
      waveformRef.current = [];
      levelRef.current = 0;
      smoothRef.current = 0;
      setNote('');
      setCents(0);
      setInTune(false);
    };
  }, [status, onReading]);

  // Hand the screen what it needs: refs for the fast stuff, state for text.
  return { note, cents, inTune, waveformRef, levelRef };
}
