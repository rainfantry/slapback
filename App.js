// =====================================================================
// App.js — THE FRONT DOOR OF THE APP
// ---------------------------------------------------------------------
// PLAIN ENGLISH: When the phone opens this app, it starts here.
// This file's only job is to put our one screen on the display and set
// the little clock/battery bar at the top to light text (because our
// app has a dark background). All the real stuff lives in the screen.
// =====================================================================

// Bring in the status bar control (the row with clock/battery at the top).
import { StatusBar } from 'expo-status-bar';
// Bring in two layout helpers from React Native:
//   SafeAreaView = a box that avoids notches/rounded corners on the phone.
//   View        = a plain rectangle container (like a <div> on the web).
import { SafeAreaView, View, StyleSheet } from 'react-native';
// Bring in our single screen. This is where the buttons and slider live.
import MonitorScreen from './src/screens/MonitorScreen';
// Bring in our colours so the background here matches the screen.
import { colors } from './src/theme';

// This function describes what shows on the display. React calls it for us.
export default function App() {
  // "return" hands back the picture to draw. The tags below are the layout.
  return (
    // SafeAreaView fills the whole phone and keeps content out of the notch.
    <SafeAreaView style={styles.safe}>
      {/* A plain container that holds the screen and lets it fill the space. */}
      <View style={styles.fill}>
        {/* Our actual app screen — the buttons, slider and switch. */}
        <MonitorScreen />
      </View>
      {/* Make the top status bar text light so it shows on our dark background. */}
      <StatusBar style="light" />
    </SafeAreaView>
  );
}

// "styles" is a small table of layout rules we refer to above by name.
const styles = StyleSheet.create({
  // Rules for the SafeAreaView: fill everything, paint it our dark colour.
  safe: {
    flex: 1,                       // "flex: 1" means "take up all the space".
    backgroundColor: colors.bg,    // our near-black background colour.
  },
  // Rules for the inner container: also fill all the available space.
  fill: {
    flex: 1,                       // again, take up everything inside the safe area.
  },
});
