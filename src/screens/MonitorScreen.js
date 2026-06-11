// =====================================================================
// MonitorScreen.js — THE WHOLE SCREEN YOU SEE AND TOUCH
// ---------------------------------------------------------------------
// PLAIN ENGLISH:
// This is the one and only screen of the app. It draws:
//   - the title at the top
//   - a big round START / STOP button
//   - a status line ("Monitoring… sing now")
//   - a delay slider (150 ms to 1000 ms) with a big number readout
//   - an Echo Cancellation on/off switch with a one-line explanation
//
// This file is "dumb" on purpose: it only LAYS OUT and DISPLAYS things.
// All the thinking (starting audio, changing delay) is done by the hook
// useDelayMonitor, which this screen asks for at the top.
// =====================================================================

// Building blocks from React Native:
//   View     = a container box.
//   Text     = on-screen words.
//   Pressable= anything you can tap (our big button).
//   Switch   = the little on/off toggle.
//   StyleSheet = where we write the look (sizes, colours, spacing).
import { View, Text, Pressable, Switch, StyleSheet } from 'react-native';
// The slider component (a separate small library, standard for React Native).
import Slider from '@react-native-community/slider';
// Our middleman hook — gives us values to show and actions to call.
import useDelayMonitor from '../hooks/useDelayMonitor';
// The pitch layer: a hook that watches the live mic and the two displays
// that show the sound wave and the note/tuner needle.
import usePitch from '../hooks/usePitch';
import Waveform from '../components/Waveform';
import TunerDisplay from '../components/TunerDisplay';
// Our colours and sizes, kept in one place.
import { colors, sizes } from '../theme';

// This function draws the screen. React runs it whenever something changes.
export default function MonitorScreen() {
  // Ask the hook for everything we need. This single line connects the
  // screen to the audio brain. We pull out the values and actions by name.
  const {
    status,        // what the engine is doing right now
    delayMs,       // current delay number
    echoCancel,    // is echo cancellation on?
    errorMessage,  // an error message to show, or null
    toggle,        // start/stop action for the big button
    changeDelay,   // action for dragging the slider
    changeEcho,    // action for flipping the switch
  } = useDelayMonitor();

  // Is the monitor currently live? True when running OR mid-start.
  const isOn = status === 'running' || status === 'starting';

  // The pitch layer. We hand it the status so it only listens to the mic
  // while we're actually monitoring. It gives us the note, the tuner needle
  // value, and a box (ref) holding the latest sound wave for drawing.
  const pitch = usePitch(status);

  // Work out the status line's words and dot colour from the status word.
  // We pick one row from this little lookup table based on "status".
  const statusInfo = {
    idle:     { text: 'Stopped — press START', color: colors.textDim },
    starting: { text: 'Starting…',             color: colors.amber },
    running:  { text: 'Monitoring… sing now',  color: colors.start },
    error:    { text: 'Audio problem',         color: colors.stop },
  }[status];

  // Return the picture to draw (the layout, top to bottom).
  return (
    <View style={styles.screen}>
      {/* ---- TITLE BLOCK ------------------------------------------- */}
      <Text style={styles.title}>Slapback</Text>
      <Text style={styles.subtitle}>hear yourself, a beat late</Text>

      {/* ---- BIG START / STOP BUTTON ------------------------------ */}
      {/* Pressable runs "toggle" when tapped. Its colour flips based on
          whether the monitor is on. The label switches between START/STOP. */}
      <Pressable
        onPress={toggle}
        style={[
          styles.button,                                   // base round shape
          { backgroundColor: isOn ? colors.stop : colors.start }, // red if on, green if off
        ]}
      >
        <Text style={styles.buttonText}>{isOn ? 'STOP' : 'START'}</Text>
      </Pressable>

      {/* ---- STATUS LINE ------------------------------------------ */}
      {/* A small coloured dot plus the status words. */}
      <View style={styles.statusRow}>
        <View style={[styles.dot, { backgroundColor: statusInfo.color }]} />
        <Text style={[styles.statusText, { color: statusInfo.color }]}>
          {statusInfo.text}
        </Text>
      </View>

      {/* If there's an error message, show it in red underneath. */}
      {errorMessage ? (
        <Text style={styles.errorText}>{errorMessage}</Text>
      ) : null}

      {/* ---- LIVE PITCH: WAVEFORM + TUNER ------------------------- */}
      {/* These only appear while monitoring. When stopped, this whole block
          is skipped (renders nothing), so the screen looks the same as before. */}
      {status === 'running' ? (
        <>
          <Waveform samplesRef={pitch.waveformRef} />
          <TunerDisplay note={pitch.note} cents={pitch.cents} inTune={pitch.inTune} />
        </>
      ) : null}

      {/* ---- DELAY CONTROL ---------------------------------------- */}
      <View style={styles.control}>
        {/* Top row: the word "Delay" on the left, the big number on the right. */}
        <View style={styles.rowBetween}>
          <Text style={styles.label}>Delay</Text>
          <Text style={styles.value}>{delayMs} ms</Text>
        </View>

        {/* The slider itself. It can slide from 150 to 1000 milliseconds.
            "onValueChange" fires continuously as you drag, calling changeDelay. */}
        <Slider
          style={styles.slider}
          minimumValue={150}                   // shortest delay allowed
          maximumValue={1000}                  // longest delay allowed
          step={10}                            // move in 10 ms jumps
          value={delayMs}                      // where the thumb sits now
          onValueChange={changeDelay}          // run our action as it moves
          minimumTrackTintColor={colors.accent}// colour of the filled part
          maximumTrackTintColor={colors.card}  // colour of the empty part
          thumbTintColor={colors.text}         // colour of the draggable knob
        />

        {/* Tiny captions under the slider showing the two ends. */}
        <View style={styles.rowBetween}>
          <Text style={styles.hint}>150 ms</Text>
          <Text style={styles.hint}>1000 ms</Text>
        </View>
      </View>

      {/* ---- ECHO CANCELLATION TOGGLE ----------------------------- */}
      <View style={styles.control}>
        {/* Row: the label on the left, the on/off Switch on the right. */}
        <View style={styles.rowBetween}>
          <Text style={styles.label}>Echo Cancellation</Text>
          <Switch
            value={echoCancel}                 // on or off
            onValueChange={changeEcho}         // flip action
            trackColor={{ false: colors.card, true: colors.accent }} // bar colour
            thumbColor={colors.text}           // knob colour
          />
        </View>
        {/* One honest line explaining what it does and when to use it. */}
        <Text style={styles.hint}>
          Reduces speaker sound feeding back into the mic. Turn OFF when using
          earbuds (cleanest sound). On Android, earbuds are the real fix.
        </Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------
// THE LOOK: every measurement and colour for the layout above, by name.
// ---------------------------------------------------------------------
const styles = StyleSheet.create({
  // The whole screen: fill it, centre things, add breathing room.
  screen: {
    flex: 1,                       // take all the space
    backgroundColor: colors.bg,    // dark background
    alignItems: 'center',          // centre children left-to-right
    paddingHorizontal: 24,         // side padding so nothing touches edges
    paddingTop: 16,                // a little space at the very top
  },
  // The big title text.
  title: {
    color: colors.text,
    fontSize: sizes.title,
    fontWeight: '800',             // very bold
    marginTop: 8,
  },
  // The small grey line under the title.
  subtitle: {
    color: colors.textDim,
    fontSize: sizes.subtitle,
    marginBottom: sizes.gap,
  },
  // The big round button: a circle made by giving it equal width/height and
  // a corner radius of half its size.
  button: {
    width: sizes.button,
    height: sizes.button,
    borderRadius: sizes.button / 2, // half of width = a perfect circle
    alignItems: 'center',           // centre the label horizontally
    justifyContent: 'center',       // centre the label vertically
    marginVertical: sizes.gap,      // space above and below
  },
  // The START / STOP word inside the button.
  buttonText: {
    color: '#0E0E10',              // dark text on the bright button
    fontSize: 30,
    fontWeight: '900',             // heaviest weight
    letterSpacing: 2,              // spread the letters out a touch
  },
  // The status row holds the dot and the status words side by side.
  statusRow: {
    flexDirection: 'row',          // lay children left-to-right
    alignItems: 'center',          // line them up vertically
    marginBottom: 4,
  },
  // The little coloured status dot.
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,               // half of width = a circle
    marginRight: 8,
  },
  // The status words.
  statusText: {
    fontSize: sizes.status,
    fontWeight: '600',
  },
  // The red error message line.
  errorText: {
    color: colors.stop,
    fontSize: sizes.hint,
    marginTop: 4,
    textAlign: 'center',
  },
  // A boxed control section (used for the slider block and the switch block).
  control: {
    width: '100%',                 // stretch full width
    backgroundColor: colors.card,  // slightly lighter panel
    borderRadius: 16,              // rounded corners
    padding: 18,                   // inner space
    marginTop: sizes.gap,          // gap above each control
  },
  // A row with one thing pushed to the left and one to the right.
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between', // push the two children apart
    alignItems: 'center',
  },
  // An ordinary label like "Delay".
  label: {
    color: colors.text,
    fontSize: sizes.label,
    fontWeight: '600',
  },
  // The big delay number readout.
  value: {
    color: colors.accent,
    fontSize: sizes.value,
    fontWeight: '800',
  },
  // The slider stretched to full width with a comfortable height.
  slider: {
    width: '100%',
    height: 40,
    marginVertical: 6,
  },
  // The tiny grey helper/caption text.
  hint: {
    color: colors.textDim,
    fontSize: sizes.hint,
    marginTop: 6,
  },
});
