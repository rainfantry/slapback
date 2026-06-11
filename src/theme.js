// =====================================================================
// theme.js — THE LOOK OF THE APP IN ONE PLACE
// ---------------------------------------------------------------------
// PLAIN ENGLISH: Every colour and size the app uses is written down here
// once. If you want to recolour the whole app or make text bigger, you
// change it HERE and it updates everywhere. No hunting through files.
// =====================================================================

// "colors" is a labelled list of the colours we use. The "#RRGGBB" codes
// are hex colours (a standard way computers name colours).
export const colors = {
  bg: '#0E0E10',        // near-black — the main background.
  card: '#1A1A1F',      // a slightly lighter dark — for raised panels.
  text: '#F5F5F5',      // off-white — the main readable text colour.
  textDim: '#9CA3AF',   // soft grey — for hints and secondary text.
  start: '#22C55E',     // green — the button colour when STOPPED (press to go).
  stop: '#EF4444',      // red — the button colour when RUNNING (press to stop).
  amber: '#F59E0B',     // amber — the "starting up" colour.
  accent: '#22C55E',    // green — the slider's filled portion / highlights.
};

// "sizes" is a labelled list of measurements (in screen points) and font
// sizes, so spacing and text stay consistent across the app.
export const sizes = {
  title: 30,            // the big app title text size.
  subtitle: 14,         // the small line under the title.
  status: 20,           // the "Monitoring… sing now" status text size.
  value: 34,            // the large delay-number readout (e.g. "380 ms").
  label: 16,            // ordinary labels like "Delay" and "Echo Cancellation".
  hint: 13,             // tiny helper lines under controls.
  button: 210,          // width AND height of the big round Start/Stop button.
  gap: 22,              // the standard gap of empty space between sections.
};
