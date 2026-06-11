// =====================================================================
// audioEngine.js — THE AUDIO BOUNDARY (the only file that touches sound)
// ---------------------------------------------------------------------
// PLAIN ENGLISH:
// This is the ONLY place in the app that talks to the mic and speaker.
// Everything else just calls the five functions at the bottom
// (start, stop, setDelay, setEchoCancel, getStatus).
//
// There are TWO ways to make sound, and we pick one based on the phone:
//
//   • ANDROID  -> our own Kotlin module ("AecMonitor"). It can do real
//                 echo cancellation by running on the phone-call pathway.
//   • iPHONE   -> the react-native-audio-api library, which gets echo
//                 cancellation for free via the phone's call mode.
//
// The rest of the app never knows or cares which one is running — it just
// calls start/stop/etc. and the right engine handles it.
// =====================================================================

import { Platform } from 'react-native';                 // tells us android vs ios
import AecMonitor from '../../modules/aec-monitor';       // our Kotlin module (null on iOS)
import { AudioContext, AudioRecorder, AudioManager } from 'react-native-audio-api';

// ---------------------------------------------------------------------
// SHARED STATE (used by both engines)
// ---------------------------------------------------------------------
let status = 'idle';            // 'idle' | 'starting' | 'running' | 'error'
let lastError = null;           // last error message text, or null
let statusListener = null;      // one function the app gives us to hear changes
let pendingDelayMs = 300;       // remembered delay for the next start()
let pendingEchoCancel = false;  // remembered echo-cancel choice

// Change the status and, if the app is listening, tell it.
function setStatus(next) {
  status = next;
  if (statusListener) statusListener(status);
}

// =====================================================================
// ANDROID ENGINE — talks to our Kotlin "AecMonitor" module
// =====================================================================
const androidEngine = {
  async start(delayMs, echoCancel) {
    // Ask the Kotlin side to open the mic+speaker and begin the delay loop.
    // (Android shows the microphone permission popup automatically on first use.)
    await AecMonitor.start(delayMs, echoCancel);
  },
  async stop() {
    // Tell Kotlin to stop the loop and hand the mic/speaker back.
    if (AecMonitor) await AecMonitor.stop();
  },
  setDelay(ms) {
    // Retune the live delay belt over in Kotlin (no glitch, no rebuild).
    if (AecMonitor) AecMonitor.setDelay(ms);
  },
  async restartForEcho(delayMs, echoCancel) {
    // Android applies echo on/off when the mic opens, so flipping it means
    // a quick stop + start with the new setting.
    await this.stop();
    await this.start(delayMs, echoCancel);
  },
};

// =====================================================================
// iPHONE ENGINE — builds a Web-Audio-style chain with react-native-audio-api
// (This is the original engine; it only runs on iOS.)
// =====================================================================
let ctx = null;        // the audio "workbench"
let recorder = null;   // the live mic
let delayNode = null;  // the delay buffer

const iosEngine = {
  async start(delayMs, echoCancel) {
    // Ask for mic permission.
    await AudioManager.requestRecordingPermissions();
    // Put iOS in play+record. 'voiceChat' turns ON Apple's echo cancellation.
    AudioManager.setAudioSessionOptions({
      iosCategory: 'playAndRecord',
      iosMode: echoCancel ? 'voiceChat' : 'default',
      iosOptions: ['allowBluetoothHFP', 'defaultToSpeaker'],
    });
    // Build the chain: mic -> bridge -> delay -> speaker.
    ctx = new AudioContext();
    delayNode = ctx.createDelay(2.0);                 // up to 2s of delay
    delayNode.delayTime.value = delayMs / 1000;       // library uses seconds
    const adapter = ctx.createRecorderAdapter();
    adapter.connect(delayNode);
    delayNode.connect(ctx.destination);
    recorder = new AudioRecorder({ sampleRate: 48000, bufferLengthInSamples: 1024 });
    recorder.connect(adapter);
    if (ctx.state === 'suspended') await ctx.resume();
    recorder.start();
  },
  async stop() {
    try { if (recorder) recorder.stop(); } catch (_) {}
    try { if (ctx) await ctx.close(); } catch (_) {}
    recorder = null; ctx = null; delayNode = null;
  },
  setDelay(ms) {
    if (delayNode && ctx) delayNode.delayTime.setValueAtTime(ms / 1000, ctx.currentTime);
  },
  async restartForEcho(delayMs, echoCancel) {
    await this.stop();
    await this.start(delayMs, echoCancel);
  },
};

// Pick the right engine ONCE, based on the phone we're on.
const impl = Platform.OS === 'android' ? androidEngine : iosEngine;

// =====================================================================
// THE PUBLIC FIVE FUNCTIONS (same contract on every phone)
// =====================================================================

async function start(options) {
  if (status === 'running' || status === 'starting') return;   // already on
  pendingDelayMs = options?.delayMs ?? pendingDelayMs;
  pendingEchoCancel = options?.echoCancel ?? pendingEchoCancel;
  setStatus('starting');
  try {
    await impl.start(pendingDelayMs, pendingEchoCancel);
    setStatus('running');
  } catch (err) {
    lastError = err?.message ?? 'Could not start audio.';
    await stop();
    setStatus('error');
    throw err;
  }
}

async function stop() {
  try { await impl.stop(); } catch (_) {}
  if (status !== 'error') setStatus('idle');
}

function setDelay(ms) {
  pendingDelayMs = ms;                 // always remember the latest value
  impl.setDelay(ms);                   // retune live if running
}

async function setEchoCancel(enabled) {
  pendingEchoCancel = enabled;
  if (status === 'running') {
    // Re-apply by quickly restarting with the new setting.
    await impl.restartForEcho(pendingDelayMs, enabled);
  }
}

function getStatus() {
  return status;
}

function onStatusChange(callback) {
  statusListener = callback;
}

function getLastError() {
  return lastError;
}

export default {
  start, stop, setDelay, setEchoCancel, getStatus, onStatusChange, getLastError,
};
