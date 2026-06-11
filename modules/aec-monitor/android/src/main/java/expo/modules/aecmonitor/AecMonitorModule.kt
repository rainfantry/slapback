// =====================================================================
// AecMonitorModule.kt — THE BRIDGE BETWEEN JAVASCRIPT AND THE KOTLIN ENGINE
// ---------------------------------------------------------------------
// PLAIN ENGLISH:
// Our app's buttons are written in JavaScript. The audio engine is
// written in Kotlin. This file is the "translator" in the middle: it
// publishes a few named functions (start, stop, setDelay, ...) that the
// JavaScript side can call, and forwards each call to the engine.
//
// The "Name(...)" line gives the module the name 'AecMonitor' — the same
// name the JavaScript door (index.js) looks for with
// requireOptionalNativeModule('AecMonitor').
// =====================================================================

package expo.modules.aecmonitor

import android.media.audiofx.AcousticEchoCanceler
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class AecMonitorModule : Module() {

  // Build the engine once, the first time it's needed. "applicationContext"
  // is the phone's app-wide handle the engine needs to reach the mic/speaker.
  private val engine by lazy {
    DelayMonitorEngine(appContext.reactContext!!.applicationContext)
  }

  // This describes everything the JavaScript side is allowed to call.
  override fun definition() = ModuleDefinition {
    // The module's public name (must match the JS side).
    Name("AecMonitor")

    // start(delayMs, aec): turn the monitor on. "Async" = runs off the main
    // thread so the app never freezes while audio sets up.
    AsyncFunction("start") { delayMs: Int, aec: Boolean ->
      engine.start(delayMs, aec)
    }

    // stop(): turn the monitor off and release the mic/speaker.
    AsyncFunction("stop") {
      engine.stop()
    }

    // setDelay(ms): change the delay live while running.
    Function("setDelay") { ms: Int ->
      engine.setDelay(ms)
    }

    // isRunning(): tell the app whether audio is currently flowing.
    Function("isRunning") {
      engine.isRunning()
    }

    // isAecAvailable(): does THIS phone offer a hardware echo canceller?
    // The app can use this to be honest in the UI about what's possible.
    Function("isAecAvailable") {
      AcousticEchoCanceler.isAvailable()
    }
  }
}
