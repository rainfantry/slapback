// =====================================================================
// TunerDisplay.js — THE BIG NOTE + THE SHARP/FLAT NEEDLE
// ---------------------------------------------------------------------
// PLAIN ENGLISH:
// This shows two things, like a guitar tuner:
//   1. The note you're singing, in big letters (e.g. "A4").
//   2. A needle on a track. Centre = perfectly in tune. Left = flat
//      (too low), right = sharp (too high). The needle glides smoothly
//      and turns green when you're bang on.
//
// It only receives finished numbers (note, cents, inTune) as "props" from
// the hook — it does no detecting itself. It's a display, nothing more.
// =====================================================================

import { useRef, useEffect } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { colors, sizes } from '../theme';
import { centsToFraction } from '../pitch/pitchMath';

export default function TunerDisplay({ note, cents, inTune }) {
  // An animated value 0..1 = where the needle sits (0 = far left/flat,
  // 0.5 = centre/in-tune, 1 = far right/sharp). Starts in the middle.
  const pos = useRef(new Animated.Value(0.5)).current;

  // Whenever the cents change, glide the needle to the new spot over 80ms
  // (a gentle slide instead of a jump).
  useEffect(() => {
    Animated.timing(pos, {
      toValue: centsToFraction(cents),
      duration: 80,
      useNativeDriver: false,     // we animate "left", which isn't GPU-driven
    }).start();
  }, [cents, pos]);

  // Turn the 0..1 value into a screen position across the track ("0%".."100%").
  const left = pos.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  // Needle colour: grey when there's no note, green when in tune, amber when
  // off. Tells you at a glance how you're doing.
  const needleColor = !note ? colors.textDim : inTune ? colors.start : colors.amber;

  return (
    <View style={styles.wrap}>
      {/* The big note letter. Shows a dim dash when no note is detected. */}
      <Text style={[styles.note, { color: note ? colors.text : colors.textDim }]}>
        {note || '–'}
      </Text>

      {/* The needle track. */}
      <View style={styles.track}>
        {/* The green "in tune" zone in the dead centre. */}
        <View style={styles.centreZone} />
        {/* The needle itself. We nudge it left by half its width so its
            CENTRE lines up with the position, not its left edge. */}
        <Animated.View
          style={[styles.needle, { left, marginLeft: -2, backgroundColor: needleColor }]}
        />
      </View>

      {/* End labels so it's obvious which way is flat and which is sharp. */}
      <View style={styles.labels}>
        <Text style={styles.label}>flat</Text>
        <Text style={styles.label}>sharp</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // The whole block, centred under the waveform.
  wrap: {
    width: '100%',
    alignItems: 'center',
    marginTop: sizes.gap,
  },
  // The big note letter+octave.
  note: {
    fontSize: sizes.note,
    fontWeight: '900',
    letterSpacing: 1,
  },
  // The horizontal track the needle rides along.
  track: {
    width: '100%',
    height: sizes.needleHeight,
    backgroundColor: colors.card,
    borderRadius: 12,
    marginTop: 6,
    justifyContent: 'center',
  },
  // The green centre band that means "you're in tune".
  centreZone: {
    position: 'absolute',
    left: '47%',
    width: '6%',                 // a narrow strip dead centre
    top: 6,
    bottom: 6,
    backgroundColor: colors.start,
    opacity: 0.25,
    borderRadius: 4,
  },
  // The moving needle (a thin tall bar).
  needle: {
    position: 'absolute',
    width: 4,
    top: 4,
    bottom: 4,
    borderRadius: 2,
  },
  // Row holding the "flat" and "sharp" captions at each end.
  labels: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  label: {
    color: colors.textDim,
    fontSize: sizes.hint,
  },
});
