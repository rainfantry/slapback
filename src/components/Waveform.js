// =====================================================================
// Waveform.js — THE SCROLLING "HEARTBEAT" SOUND WAVE
// ---------------------------------------------------------------------
// PLAIN ENGLISH:
// This draws your voice as a wiggly line, like a heart monitor. Sound is
// just a list of tiny numbers between -1 and +1; we draw each number as a
// point (loud = far from the middle, quiet = near it) and join them up.
//
// It reads the latest wave from a "ref" (a box the hook keeps filling) on
// its OWN little clock, and redraws only ITSELF — so the rest of the
// screen never has to redraw. That's what keeps things smooth.
// =====================================================================

import { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
// react-native-svg lets us draw lines and shapes (like drawing on paper).
import Svg, { Polyline, Line } from 'react-native-svg';
import { colors, sizes } from '../theme';

// We draw inside an imaginary 320-wide by 96-tall box. SVG then stretches
// that box to fill whatever real width the phone gives us.
const VIEW_W = 320;
const VIEW_H = 96;
const MID = VIEW_H / 2;     // the middle line (silence sits here)

// "samplesRef" = the box holding the latest wave points (from usePitch).
export default function Waveform({ samplesRef }) {
  // "points" is the text SVG needs: "x1,y1 x2,y2 x3,y3 ...".
  const [points, setPoints] = useState('');

  useEffect(() => {
    // Our own redraw clock: ~30 times a second, read the ref and rebuild
    // the line. This setState only redraws THIS component, nothing else.
    const id = setInterval(() => {
      const s = samplesRef.current || [];
      if (!s.length) { setPoints(''); return; }      // nothing yet — blank

      // Spread the points evenly across the width.
      const stepX = VIEW_W / (s.length - 1);
      let out = '';
      for (let i = 0; i < s.length; i++) {
        const x = (i * stepX).toFixed(1);
        // s[i] is roughly -1..+1. Multiply by 90% of half-height so a loud
        // wave nearly fills the box but doesn't clip the edges. Subtract from
        // MID because on screens, y grows DOWNWARD.
        const y = (MID - s[i] * MID * 0.9).toFixed(1);
        out += `${x},${y} `;
      }
      setPoints(out.trim());
    }, 33);

    // Stop our clock when this component goes away.
    return () => clearInterval(id);
  }, [samplesRef]);

  return (
    <View style={styles.card}>
      {/* width="100%" + preserveAspectRatio="none" = stretch to fit the phone */}
      <Svg width="100%" height={sizes.waveformHeight} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="none">
        {/* A faint centre line so an empty/quiet signal still shows a baseline. */}
        <Line x1="0" y1={MID} x2={VIEW_W} y2={MID} stroke={colors.bg} strokeWidth="1" />
        {/* The actual sound wave, only drawn when we have points. */}
        {points ? (
          <Polyline points={points} fill="none" stroke={colors.accent} strokeWidth="2" />
        ) : null}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  // The dark rounded panel the wave sits in (matches the other controls).
  card: {
    width: '100%',
    height: sizes.waveformHeight,
    backgroundColor: colors.card,
    borderRadius: 16,
    overflow: 'hidden',           // keep the wave inside the rounded corners
    marginTop: sizes.gap,
  },
});
