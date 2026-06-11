// =====================================================================
// DelayMonitorEngine.kt — THE ACTUAL ECHO-CANCELLING DELAY LOOP (Android)
// ---------------------------------------------------------------------
// PLAIN ENGLISH:
// This is the Android version of the Slapback engine, written in Kotlin.
// It does what the iPhone gets for free, by hand:
//
//   1. Opens the mic on the phone's "phone-call" pathway. Doing that
//      switches on the phone's built-in ECHO CANCELLER (the same chip
//      that stops you hearing yourself on speakerphone).
//   2. Reads the mic sound in tiny chunks and drops them on the delay
//      "conveyor belt" (ShortRing).
//   3. Picks sound off the far end of the belt and plays it out the
//      speaker — always a chosen number of milliseconds behind.
//
// Because the mic and speaker both run on the phone-call pathway, the
// echo canceller knows what we're playing and subtracts it back out of
// the mic — so the speaker's sound doesn't loop and howl.
//
// TRADE-OFF (important): the phone-call pathway is tuned for SPEECH, so
// the sound is bandlimited — it sounds like a phone call, not hi-fi.
// That is the price of getting echo cancellation on Android.
// =====================================================================

package expo.modules.aecmonitor

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioRecord
import android.media.AudioTrack
import android.media.MediaRecorder
import android.media.audiofx.AcousticEchoCanceler
import kotlin.concurrent.thread

class DelayMonitorEngine(private val context: Context) {

  // --- FIXED AUDIO SETTINGS -------------------------------------------
  private val sampleRate = 48000                          // 48,000 samples per second
  private val inChannel = AudioFormat.CHANNEL_IN_MONO     // one mic channel
  private val outChannel = AudioFormat.CHANNEL_OUT_MONO   // one speaker channel
  private val encoding = AudioFormat.ENCODING_PCM_16BIT   // each sample is a 16-bit number

  // --- LIVE STATE (changes while running) -----------------------------
  // "@Volatile" means: safe to read/write from two threads at once
  // (our audio loop runs on its own thread, separate from the app).
  @Volatile private var running = false                   // is the loop active?
  @Volatile private var targetDelaySamples = 0            // desired delay, in samples
  private var worker: Thread? = null                      // the background audio loop
  private var record: AudioRecord? = null                 // the microphone
  private var track: AudioTrack? = null                   // the speaker
  private var aec: AcousticEchoCanceler? = null           // the echo canceller

  // Is the monitor currently running? (the JS app asks this)
  fun isRunning(): Boolean = running

  // Turn the desired delay (in ms) into a number of audio samples.
  private fun msToSamples(ms: Int): Int = (ms.toLong() * sampleRate / 1000L).toInt()

  // =====================================================================
  // start(delayMs, enableAec) — open mic + speaker and begin the loop
  // =====================================================================
  fun start(delayMs: Int, enableAec: Boolean) {
    if (running) return                                   // already going — do nothing
    targetDelaySamples = msToSamples(delayMs)             // remember the delay we want

    // Work out the smallest safe buffer sizes the phone will accept.
    val minRec = AudioRecord.getMinBufferSize(sampleRate, inChannel, encoding)
    val minPlay = AudioTrack.getMinBufferSize(sampleRate, outChannel, encoding)

    // Switch the phone into "call mode" and force sound out the loudspeaker.
    // Call mode is what turns the echo canceller pathway on.
    val am = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    am.mode = AudioManager.MODE_IN_COMMUNICATION
    am.isSpeakerphoneOn = true

    // Open the mic. If echo cancellation is wanted, use the VOICE_COMMUNICATION
    // source (the call pathway, which applies the phone's AEC). If not, use the
    // plain MIC source for cleaner, fuller sound (best with earbuds).
    val source = if (enableAec) MediaRecorder.AudioSource.VOICE_COMMUNICATION
                 else MediaRecorder.AudioSource.MIC
    record = AudioRecord(source, sampleRate, inChannel, encoding, minRec * 2)

    // Belt-and-braces: explicitly attach the hardware echo canceller too,
    // if the app asked for it and this phone offers one.
    if (enableAec && AcousticEchoCanceler.isAvailable()) {
      aec = AcousticEchoCanceler.create(record!!.audioSessionId)?.also { it.enabled = true }
    }

    // Open the speaker. When cancelling, mark the output as voice-communication
    // so the echo canceller knows this is the sound to subtract from the mic.
    val attrs = AudioAttributes.Builder()
      .setUsage(
        if (enableAec) AudioAttributes.USAGE_VOICE_COMMUNICATION
        else AudioAttributes.USAGE_MEDIA
      )
      .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
      .build()
    val fmt = AudioFormat.Builder()
      .setSampleRate(sampleRate)
      .setChannelMask(outChannel)
      .setEncoding(encoding)
      .build()
    track = AudioTrack(attrs, fmt, minPlay * 2, AudioTrack.MODE_STREAM, AudioManager.AUDIO_SESSION_ID_GENERATE)

    // Flip the switch and press record/play.
    running = true
    record!!.startRecording()
    track!!.play()

    // Run the actual mic->belt->speaker loop on its OWN thread, so the app
    // stays smooth while audio flows continuously in the background.
    worker = thread(start = true, name = "DelayMonitor") {
      val chunk = ShortArray(256)                         // tiny chunk = low latency
      // The delay belt. Size it for up to ~3 seconds so there's always slack.
      val belt = ShortRing(sampleRate * 3)
      // Pre-load the belt with SILENCE equal to the delay. This is the trick
      // that makes the output start out one "delay" behind the input.
      belt.write(ShortArray(targetDelaySamples))

      while (running) {
        // 1) Read a chunk of live mic sound.
        val n = record!!.read(chunk, 0, chunk.size)
        if (n > 0) {
          // 2) Drop it on the belt.
          belt.write(chunk, n)
          // 3) Keep the belt's length matching the delay the user picked
          //    (handles live slider changes — pad with silence to lengthen,
          //    drop samples to shorten). The 480 is a small dead-zone so we
          //    don't fidget on every tiny difference.
          val cur = belt.size()
          val target = targetDelaySamples
          if (cur < target - 480) belt.write(ShortArray(target - cur))
          else if (cur > target + 480) belt.drop(cur - target)
          // 4) Pick the delayed sound off the far end and play it.
          val out = ShortArray(n)
          val got = belt.read(out, n)
          if (got > 0) track!!.write(out, 0, got)
        }
      }
    }
  }

  // Change the delay while running (the slider calls this). The loop above
  // notices the new target on its next pass and adjusts the belt length.
  fun setDelay(delayMs: Int) {
    targetDelaySamples = msToSamples(delayMs)
  }

  // =====================================================================
  // stop() — end the loop and hand the mic/speaker back to the phone
  // =====================================================================
  fun stop() {
    running = false                                       // tell the loop to finish
    try { worker?.join(200) } catch (_: Exception) {}     // wait briefly for it to end
    worker = null

    // Release everything in a safe order, ignoring errors during teardown.
    try { record?.stop() } catch (_: Exception) {}
    try { record?.release() } catch (_: Exception) {}
    try { aec?.release() } catch (_: Exception) {}
    try { track?.stop() } catch (_: Exception) {}
    try { track?.release() } catch (_: Exception) {}
    record = null; track = null; aec = null

    // Put the phone's audio back to normal (out of call mode, speaker off).
    val am = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    am.mode = AudioManager.MODE_NORMAL
    am.isSpeakerphoneOn = false
  }
}
