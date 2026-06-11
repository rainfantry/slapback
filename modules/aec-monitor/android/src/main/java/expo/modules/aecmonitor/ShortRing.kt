// =====================================================================
// ShortRing.kt — A SIMPLE "CONVEYOR BELT" FOR SOUND SAMPLES
// ---------------------------------------------------------------------
// PLAIN ENGLISH:
// Sound, to a computer, is just a long list of tiny numbers ("samples").
// To DELAY the sound, we put those numbers on a conveyor belt: we drop
// them on at one end (from the mic) and pick them up at the other end
// (to the speaker). If the belt always holds, say, 300ms worth of
// numbers, then whatever comes out is always 300ms behind what went in.
// That belt is exactly what this file is — a fixed-size loop of memory
// you write into and read out of. ("Short" = the number type we use for
// each audio sample; "Ring" = it wraps around when it reaches the end.)
// =====================================================================

package expo.modules.aecmonitor

// "capacity" = how many samples the belt can hold at most.
class ShortRing(capacity: Int) {
  private val buf = ShortArray(capacity)  // the actual memory holding samples
  private var head = 0                     // where we READ from next
  private var tail = 0                     // where we WRITE to next
  private var count = 0                    // how many samples are on the belt now

  // How many samples are currently waiting on the belt.
  fun size(): Int = count

  // Put "len" samples from "src" onto the belt.
  fun write(src: ShortArray, len: Int = src.size) {
    for (i in 0 until len) {
      // If the belt is completely full, drop the oldest sample to make room
      // (this should rarely happen — the belt is sized with plenty of slack).
      if (count == buf.size) {
        head = (head + 1) % buf.size
        count--
      }
      buf[tail] = src[i]                   // drop the new sample on the belt
      tail = (tail + 1) % buf.size         // advance the write spot (wrap around)
      count++
    }
  }

  // Take up to "len" samples off the belt into "dst". Returns how many we got.
  fun read(dst: ShortArray, len: Int): Int {
    val n = if (len < count) len else count   // can't read more than we have
    for (i in 0 until n) {
      dst[i] = buf[head]                    // pick the oldest sample off the belt
      head = (head + 1) % buf.size          // advance the read spot (wrap around)
      count--
    }
    return n
  }

  // Throw away "len" of the oldest samples (used to SHORTEN the delay live).
  fun drop(len: Int) {
    val n = if (len < count) len else count
    head = (head + n) % buf.size
    count -= n
  }
}
