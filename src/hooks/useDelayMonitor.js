// =====================================================================
// useDelayMonitor.js — THE MIDDLEMAN BETWEEN SCREEN AND AUDIO
// ---------------------------------------------------------------------
// PLAIN ENGLISH:
// The screen (buttons + slider) should not poke the audio engine directly.
// This file is a friendly "middleman" (in React, a reusable middleman is
// called a "hook", and by convention its name starts with "use").
//
// It does three jobs:
//   1) Remembers the numbers the screen needs to show (delay, on/off, etc.)
//   2) Gives the screen simple actions: toggle(), setDelay(), setEcho().
//   3) Cleans up safely (stops the mic) when the app closes or goes to the
//      background, so the microphone is never left secretly running.
// =====================================================================

// React tools:
//   useState  = remember a value and re-draw the screen when it changes.
//   useEffect = run setup/cleanup code at the right moments.
//   useRef    = remember a value WITHOUT re-drawing (used for a timer).
//   useCallback = keep a function stable so it isn't rebuilt every redraw.
import { useState, useEffect, useRef, useCallback } from 'react';
// AppState tells us when the app moves to the background or comes back.
import { AppState } from 'react-native';
// Our audio engine — the only thing that actually makes sound.
import engine from '../audio/audioEngine';

// This is the hook. The screen calls it once and gets back an object full
// of values and actions it can use.
export default function useDelayMonitor() {
  // --- REMEMBERED VALUES (state) ---------------------------------------
  // The current status word from the engine. Starts as 'idle' (stopped).
  const [status, setStatus] = useState('idle');
  // The current delay in milliseconds. Starts at 300 ms.
  const [delayMs, setDelayMs] = useState(300);
  // Whether echo cancellation is ON. Starts OFF (best with earbuds).
  const [echoCancel, setEchoCancel] = useState(false);
  // The last error text to show the user, or null when there is none.
  const [errorMessage, setErrorMessage] = useState(null);

  // A tiny private timer used to avoid spamming the audio engine while the
  // finger drags the slider. useRef keeps it without causing redraws.
  const throttleRef = useRef(null);

  // --- KEEP THE STATUS IN SYNC ----------------------------------------
  // When this hook first runs, tell the engine: "whenever your status
  // changes, update my status value (which redraws the screen)."
  useEffect(() => {
    // Hand the engine a function to call on every status change.
    engine.onStatusChange((next) => {
      setStatus(next);                       // update our remembered status.
      if (next === 'error') {                // if it became an error...
        setErrorMessage(engine.getLastError()); // ...grab the message to show.
      }
    });
    // The "cleanup" below runs if the screen ever goes away: stop listening.
    return () => engine.onStatusChange(null);
  }, []); // the empty [] means "only do this once, at the start".

  // --- STOP THE MIC WHEN THE APP IS BACKGROUNDED ----------------------
  // If the user switches apps while monitoring, we stop the engine so the
  // microphone is never left running invisibly. They press Start again when
  // they come back — a deliberate, safe choice (no hidden hot mic).
  useEffect(() => {
    // Listen for the app changing between foreground/background.
    const sub = AppState.addEventListener('change', (state) => {
      // 'active' means on-screen. Anything else means hidden/backgrounded.
      if (state !== 'active') {
        engine.stop();   // hidden -> make sure the mic is released.
      }
    });
    // Cleanup: stop listening when the screen goes away.
    return () => sub.remove();
  }, []);

  // --- SAFETY NET ON UNMOUNT ------------------------------------------
  // If this screen is ever destroyed, make absolutely sure audio is stopped.
  useEffect(() => {
    return () => { engine.stop(); };
  }, []);

  // --- ACTIONS THE SCREEN CAN CALL ------------------------------------

  // toggle(): if stopped, start; if running, stop. Wired to the big button.
  const toggle = useCallback(async () => {
    // Read the engine's real status so we never get out of sync.
    const current = engine.getStatus();
    if (current === 'running' || current === 'starting') {
      // It's on -> turn it off.
      await engine.stop();
    } else {
      // It's off -> clear any old error and turn it on with current settings.
      setErrorMessage(null);
      try {
        await engine.start({ delayMs, echoCancel });
      } catch (_) {
        // The engine already set status to 'error' and stored the message;
        // our status listener will display it. Nothing else to do here.
      }
    }
  }, [delayMs, echoCancel]); // rebuild this action if delay/echo change.

  // changeDelay(ms): called as the finger drags the slider.
  // We update the on-screen number EVERY time (cheap), but only poke the
  // audio engine at most ~every 30ms (to avoid flooding it).
  const changeDelay = useCallback((ms) => {
    // Round to a whole number of milliseconds and update the display now.
    const rounded = Math.round(ms);
    setDelayMs(rounded);

    // If a poke is already scheduled, let it handle this value too.
    if (throttleRef.current) return;
    // Otherwise schedule a single engine update ~30ms from now.
    throttleRef.current = setTimeout(() => {
      engine.setDelay(rounded);     // actually retune the live delay buffer.
      throttleRef.current = null;   // clear the timer so the next drag can fire.
    }, 30);
  }, []);

  // changeEcho(on): called when the Echo Cancellation switch is flipped.
  const changeEcho = useCallback(async (on) => {
    setEchoCancel(on);                 // update the on-screen switch position.
    await engine.setEchoCancel(on);    // apply it (restarts audio if running).
  }, []);

  // --- HAND EVERYTHING BACK TO THE SCREEN -----------------------------
  // The screen reads these values and calls these actions. That's the whole
  // contract — the screen never imports the audio engine itself.
  return {
    status,          // 'idle' | 'starting' | 'running' | 'error'
    delayMs,         // current delay number to display
    echoCancel,      // is echo cancellation on?
    errorMessage,    // text to show if something went wrong (or null)
    toggle,          // start/stop the monitor
    changeDelay,     // move the delay slider
    changeEcho,      // flip the echo-cancel switch
  };
}
