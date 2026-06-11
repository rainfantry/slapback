// =====================================================================
// aec-monitor/index.js — THE JAVASCRIPT DOOR TO THE NATIVE ANDROID CODE
// ---------------------------------------------------------------------
// PLAIN ENGLISH:
// The real work (the echo-cancelling delay loop) is written in Kotlin —
// the language Android understands — over in the android/ folder.
// This tiny file is just the "doorway" the rest of our JavaScript app
// uses to call into that Kotlin code.
//
// "requireOptionalNativeModule" tries to find the native module named
// 'AecMonitor'. The word OPTIONAL matters: on iPhone this module does
// not exist (we only built it for Android), so instead of crashing, it
// quietly returns null. Our audio engine checks for that null and just
// uses the iPhone audio path instead.
// =====================================================================

import { requireOptionalNativeModule } from 'expo-modules-core';

// Hand back the native module (on Android) or null (on iPhone/web).
export default requireOptionalNativeModule('AecMonitor');
