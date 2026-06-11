// =====================================================================
// audioEngine.js — THE AUDIO BOUNDARY (the only file that touches sound)
// ---------------------------------------------------------------------
// PLAIN ENGLISH:
// This is the ONLY place in the whole app that talks to the phone's
// microphone and speaker. Everything else in the app just calls the five
// simple functions at the bottom (start, stop, setDelay, setEchoCancel,
// getStatus) and never worries about HOW the sound works.
//
// What this engine does, in one sentence:
//   It takes sound coming IN from the mic, holds it for a chosen number
//   of milliseconds (the "delay"), then plays it back OUT the speaker or
//   earbuds — over and over, continuously — so a singer hears their own
//   voice a fraction of a second late and can correct on the fly.
//
// The chain of sound looks like this:
//   MICROPHONE  ->  (bridge)  ->  DELAY BUFFER  ->  SPEAKER / EARBUDS
//
// LIBRARY USED: react-native-audio-api (by Software Mansion). It copies
// the "Web Audio" style used in browsers: you build a little chain of
// "nodes" and connect them together like plugging in guitar pedals.
//
// >>> IMPORTANT FOR FUTURE BUILDS <<<
// The exact method names below (createRecorderAdapter, createDelay, etc.)
// match react-native-audio-api v0.12.x. If a future version renames them,
// THIS is the only file you fix. The rest of the app stays untouched.
// =====================================================================

// Pull the three tools we need out of the audio library:
//   AudioContext = the "workbench" we build the sound chain on.
//   AudioRecorder = the live microphone source.
//   AudioManager  = the phone-level settings (permissions, speaker routing).
import { AudioContext, AudioRecorder, AudioManager } from 'react-native-audio-api';

// ---------------------------------------------------------------------
// PRIVATE MEMORY (only this file can see these)
// These variables remember the live audio pieces while the app runs.
// They start as "null" which means "nothing built yet".
// ---------------------------------------------------------------------
let context = null;       // the workbench (AudioContext) once we build it.
let recorder = null;      // the live microphone once we open it.
let delayNode = null;     // the delay buffer that holds sound for X milliseconds.
let analyser = null;      // a "listening tap" on the mic, used by the pitch layer
                          // to read the live sound wave (for the note + waveform).

// These remember the user's chosen settings even while the engine is OFF,
// so that pressing START later uses the values they already picked.
let pendingDelayMs = 300;   // start at 300 ms (a comfortable default delay).
let pendingEchoCancel = false; // echo cancellation OFF by default (best for earbuds).

// "status" is a single word describing what the engine is doing right now.
// It is always one of: 'idle' | 'starting' | 'running' | 'error'.
let status = 'idle';        // we begin stopped ("idle").
let lastError = null;       // remembers the last error message, if any.

// A place to remember ONE function the app gives us, so we can tell it
// whenever the status changes (instead of the app constantly asking).
let statusListener = null;

// Helper: change the status word and, if the app asked to be told, tell it.
// (This keeps the on-screen status line in sync with reality.)
function setStatus(next) {
  status = next;                       // remember the new status word.
  if (statusListener) {                // if the app gave us a function to call...
    statusListener(status);            // ...call it with the new status.
  }
}

// =====================================================================
// start(options) — TURN THE MONITOR ON
// Builds the mic -> delay -> speaker chain and begins playing.
// options = { delayMs: number, echoCancel: boolean }
// =====================================================================
async function start(options) {
  // If we are already running, do nothing (pressing START twice is harmless).
  if (status === 'running' || status === 'starting') return;

  // Read the requested settings; if missing, fall back to remembered ones.
  pendingDelayMs = options?.delayMs ?? pendingDelayMs;        // chosen delay.
  pendingEchoCancel = options?.echoCancel ?? pendingEchoCancel; // chosen AEC.

  // Tell everyone we are in the middle of starting up.
  setStatus('starting');

  // We wrap the risky setup in try/catch so a failure becomes a clean error
  // instead of crashing the app.
  try {
    // STEP 1: Ask the user for permission to use the microphone. The phone
    // shows a popup the first time. Without this, recording is blocked.
    await AudioManager.requestRecordingPermissions();

    // STEP 2: Tell the phone how we want to use audio:
    //   playAndRecord = use mic and speaker at the same time.
    //   iosMode 'voiceChat' = on iPhones, turn ON the OS echo cancellation
    //       (the same trick phone calls use so you don't hear yourself).
    //       NOTE: on Android this does NOT enable echo cancellation — the
    //       library does not expose that yet, so on Android use earbuds.
    //   allowBluetoothHFP = let Bluetooth earbuds work.
    //   defaultToSpeaker  = if no earbuds, play out the loud speaker.
    AudioManager.setAudioSessionOptions({
      iosCategory: 'playAndRecord',
      iosMode: pendingEchoCancel ? 'voiceChat' : 'default',
      iosOptions: ['allowBluetoothHFP', 'defaultToSpeaker'],
    });

    // STEP 3: Build the "workbench" we connect everything on.
    context = new AudioContext();

    // STEP 4: Build the DELAY BUFFER. The number (2.0) is the MAXIMUM delay
    // in seconds we allow — 2 seconds comfortably covers our 1000 ms top end.
    delayNode = context.createDelay(2.0);

    // Set the starting delay. The library works in SECONDS, but our app
    // thinks in MILLISECONDS, so we divide by 1000 (1000 ms = 1 second).
    delayNode.delayTime.value = pendingDelayMs / 1000;

    // STEP 5: Build a "bridge" node. The live microphone can't plug straight
    // into the chain; this adapter is the socket it plugs into.
    const adapter = context.createRecorderAdapter();

    // STEP 6: Build the "listening tap" (analyser) for the pitch/waveform
    // layer. An analyser is a PASS-THROUGH node: sound goes in one side and
    // out the other UNCHANGED, but along the way the pitch layer gets to peek
    // at the live wave. The key thing: it must sit INSIDE the path that reaches
    // the speaker. If it just dangled off to the side, this audio engine would
    // have no reason to push sound through it, and the tap would read silence
    // (which is exactly the bug where the wave didn't move).
    //   fftSize = how many samples it hands over at once (2048 = enough to
    //   measure low notes). smoothingTimeConstant 0 = raw wave, no averaging.
    analyser = context.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0;

    // Wire the pedals together, in order:
    //   bridge -> analyser (the tap) -> delay buffer -> speaker/earbuds.
    adapter.connect(analyser);              // dry mic flows INTO the tap
    analyser.connect(delayNode);            // tap passes the sound on to the delay
    delayNode.connect(context.destination); // delay out to the speaker/earbuds

    // STEP 7: Open the actual microphone and plug it into the bridge.
    recorder = new AudioRecorder({
      sampleRate: 48000,   // 48000 samples/sec = standard high-quality audio.
      bufferLengthInSamples: 1024, // small chunks = lower latency (snappier).
    });
    recorder.connect(adapter);

    // STEP 8: Some phones start the workbench "paused". Wake it up.
    if (context.state === 'suspended') {
      await context.resume();
    }

    // STEP 9: Press play on the microphone. Sound now flows continuously:
    //   mic -> bridge -> delay -> speaker. The monitor is LIVE.
    recorder.start();

    // Tell everyone we are now fully running.
    setStatus('running');
  } catch (err) {
    // If anything above failed (e.g. mic permission denied), record why,
    // clean up any half-built pieces, and report an error state.
    lastError = err?.message ?? 'Could not start audio.';
    await stop();              // tear down whatever was created.
    setStatus('error');        // show the error state to the app.
    throw err;                 // also pass the error up so callers can see it.
  }
}

// =====================================================================
// stop() — TURN THE MONITOR OFF
// Stops playback, releases the mic, and frees the audio workbench so the
// phone is fully quiet and nothing keeps secretly recording.
// =====================================================================
async function stop() {
  // STEP 1: Stop the microphone if it exists.
  try {
    if (recorder) recorder.stop();
  } catch (_) { /* ignore — we are tearing down anyway. */ }

  // STEP 2: Close the workbench if it exists (this frees the speaker too).
  try {
    if (context) await context.close();
  } catch (_) { /* ignore — we are tearing down anyway. */ }

  // STEP 3: Forget all the pieces so the next start() builds fresh ones.
  recorder = null;
  context = null;
  delayNode = null;
  analyser = null;       // drop the listening tap too.

  // STEP 4: Unless we are reporting an error, mark ourselves stopped.
  if (status !== 'error') setStatus('idle');
}

// =====================================================================
// setDelay(ms) — CHANGE THE DELAY WHILE RUNNING (no glitch)
// IMPORTANT: this only NUDGES the existing delay buffer. It never rebuilds
// the chain, because rebuilding on every slider wiggle would crackle.
// =====================================================================
function setDelay(ms) {
  // Always remember the latest value for the next time we start.
  pendingDelayMs = ms;

  // If we are running, retune the live delay buffer smoothly.
  if (delayNode && context) {
    // "setValueAtTime" changes the delay cleanly at the current moment,
    // which avoids clicks. We divide by 1000 to turn ms into seconds.
    delayNode.delayTime.setValueAtTime(ms / 1000, context.currentTime);
  }
}

// =====================================================================
// setEchoCancel(enabled) — TURN OS ECHO CANCELLATION ON/OFF
// Echo cancellation tries to stop the speaker sound from feeding back into
// the mic (which causes a howl). On iPhone this works via call-mode. On
// Android the library can't do it yet, so earbuds are the real fix there.
// Because the setting is chosen when the audio session opens, flipping it
// while running means we quickly stop and start again to re-apply it.
// =====================================================================
async function setEchoCancel(enabled) {
  // Remember the choice for the next start().
  pendingEchoCancel = enabled;

  // If we are live right now, restart so the new setting takes effect.
  if (status === 'running') {
    await stop();                                   // tear down...
    await start({ delayMs: pendingDelayMs, echoCancel: enabled }); // ...rebuild.
  }
}

// =====================================================================
// getStatus() — REPORT WHAT WE ARE DOING
// Returns one word so the screen can show the right message and colour.
// =====================================================================
function getStatus() {
  return status;   // 'idle' | 'starting' | 'running' | 'error'.
}

// Optional helper: let the app hand us ONE function to be called every time
// the status changes. This keeps the on-screen status perfectly in sync.
function onStatusChange(callback) {
  statusListener = callback;     // remember the function (or null to clear).
}

// Optional helper: let the app read the last error message to display it.
function getLastError() {
  return lastError;              // a text message, or null if no error.
}

// Hand the pitch layer the "listening tap" so it can read the live sound wave.
// Returns the analyser while running, or null when stopped. The pitch layer
// only READS from this — it never changes the audio you hear.
function getAnalyser() {
  return analyser;
}

// =====================================================================
// THE PUBLIC DOOR: bundle the five core functions (plus two helpers) into
// one object and hand it out. The rest of the app only ever uses these.
// =====================================================================
export default {
  start,            // turn monitor on
  stop,             // turn monitor off
  setDelay,         // change delay live
  setEchoCancel,    // toggle echo cancellation
  getStatus,        // read current status word
  onStatusChange,   // subscribe to status changes
  getLastError,     // read last error message
  getAnalyser,      // hand the pitch layer the mic "listening tap"
};
