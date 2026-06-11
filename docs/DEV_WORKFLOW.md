# Dev Workflow — Live Reload & On-Device Diagnostics

> **For any AI or developer working on this Expo app.** This explains how to run
> the app with **live reload** (edit code → see it on a real phone in seconds)
> and how to **diagnose problems on-device by reading logs**. Set the project up
> this way so iteration is fast and bugs are observable, not guessed at.

---

## The core idea: two kinds of build

| | **Development build** (dev client) | **Standalone APK** (preview/production) |
|---|---|---|
| JS code | NOT inside the app — **streamed live** from a Metro server on your computer | **baked in**, frozen at build time |
| Live reload | ✅ yes — edit code, it reloads in seconds | ❌ no — must rebuild the whole app to change anything |
| Needs your computer running? | ✅ yes (same wifi / LAN) | ❌ no — fully standalone, runs offline forever |
| Use it for | **building & debugging** | **shipping / daily use** |
| Build profile | `eas build --profile development` | `eas build --profile preview` |

**Key point:** the dev build needs your computer's Metro server on the **same
local wifi** (LAN, not the internet). The standalone APK needs nothing. You
develop on the dev build, then ship a standalone APK.

---

## One-time setup

```bash
# 1. Build the development client (cloud build, ~10 min). Do this ONCE.
eas build --profile development --platform android
# 2. Install the resulting .apk on the phone (from the EAS link).
```

`eas.json` must contain a `development` profile (it does in this repo):
```json
"development": {
  "developmentClient": true,
  "distribution": "internal",
  "android": { "buildType": "apk" }
}
```

---

## The daily loop

```bash
# In the project folder, start the dev server:
npx expo start --dev-client
```

Then connect the phone:

1. Phone and computer on the **same wifi**.
2. Find the computer's LAN IP (`ipconfig` on Windows → the `192.168.x.x` on the
   wifi adapter; ignore virtual adapters like `192.168.56.x`).
3. In the dev-build app, tap **"Enter URL manually"** → `http://<LAN_IP>:8081`
   (or pick the server from the auto-discovered **Development servers** list).

The app downloads the JS from Metro and runs it. **Now: edit any `.js` file →
save → the app reloads automatically (Fast Refresh).** No rebuild.

> If LAN discovery fails (isolated networks, firewall): `npx expo start
> --dev-client --tunnel` routes over the internet instead. Slower, but bypasses
> network issues. On Windows, allow Node through the firewall when prompted.

---

## On-device diagnostics: reading logs

This is how you debug behaviour you can't see from the code alone (is a loop
firing? is data changing? what value did a function return?).

**1. Add a log in the code.** `console.log(...)` from anywhere in the app:

```js
// Example: a 30-times-a-second loop, logging every ~0.5s so the output
// is readable instead of a flood. Tag logs with a [prefix] so you can find them.
let diagCount = 0;
function tick() {
  // ... do work, compute `level`, `note`, etc ...
  diagCount++;
  if (diagCount % 15 === 0) {                 // throttle: 1 in 15 ticks
    console.log(`[pitch] tick=${diagCount} level=${level.toFixed(4)} note=${note || '-'}`);
  }
}
```

**2. Where it outputs:** every `console.log` from the phone appears **in the
terminal running `npx expo start`**, prefixed with `LOG`:

```
LOG  [pitch] tick=15  level=0.0260 rawHz=null   note=-
LOG  [pitch] tick=30  level=0.6081 rawHz=146.8  note=D3
LOG  [pitch] tick=45  level=0.7056 rawHz=147.1  note=D3
```

That live stream is the debugging gold. It tells you what's *actually* happening
on the device in real time, not what you assume.

**3. The diagnostic loop:**
```
add console.log  →  save (Fast Refresh)  →  reproduce on phone  →  read Metro logs
   →  understand root cause  →  fix  →  remove the temporary logs
```

Tag temporary logs (e.g. `// TEMP DIAGNOSTIC`) and delete them once the bug is
fixed, so they don't ship.

> If an AI agent is driving this headless (no human watching the terminal),
> redirect Metro's output to a file and read it:
> `npx expo start --dev-client > metro.log 2>&1 &` then read `metro.log`.

---

## Switching between dev mode and a standalone APK

- **Dev mode (live reload):** `npx expo start --dev-client` + the development
  build installed. For building and debugging. Needs the computer on wifi.
- **Standalone APK (the real app):** `eas build --profile preview --platform
  android` → install the `.apk`. Runs offline, no computer, no reload. **This is
  also the honest performance test** — dev builds run slow, unoptimised JS, so
  always confirm speed/smoothness on a preview APK before blaming the device.

Rule of thumb: **debug logic in dev mode, judge performance on a preview APK.**

---

## AI-assisted live diagnostics (the method that fixed the pitch bug)

This is the high-leverage move: an AI agent and a human debugging a real device
**together**, using live logs as the shared source of truth. The human runs the
phone; the AI reads the logs and reasons about them. No guessing — the device
tells you what's actually happening.

### The setup

1. The AI starts the dev server so its output is captured to a file it can read:
   ```bash
   npx expo start --dev-client > metro.log 2>&1 &
   ```
   (Or any setup where the agent can read Metro's stdout. The point is the
   `console.log` stream must land somewhere the AI can open.)
2. The human connects the phone (LAN URL) and reproduces the problem.
3. The AI **reads the log file** and reasons from the real numbers.

### The loop

```
AI adds a tagged diagnostic log  →  human reloads + reproduces on the phone
   →  AI reads Metro logs  →  AI sees the actual values  →  AI fixes the cause
   →  Fast Refresh pushes the fix  →  human confirms  →  AI removes the temp logs
```

Each turn is seconds, not a 15-minute rebuild — because only JS reloads.

### Worked example — why the tuner showed no note

The symptom: the note/needle never moved. Three guesses were possible (dead
loop, stale data, or a render freeze). Instead of guessing, we logged the
pipeline:

```js
if (tickN % 15 === 0) {
  console.log(`[pitch] t=${tickN} level=${level.toFixed(3)} rawHz=${rawHz} note=${note||'-'}`);
}
```

The logs answered it immediately:
```
[pitch] level=0.776 rawHz=7637.7 note=-      ← detector returns 7800 Hz garbage
```
The loop WAS firing, the data WAS live and changing, and the loudness tracked
the voice — but the pitch detector reported ~7800 Hz for a hummed note (should
be ~150 Hz). So the bug wasn't the loop or the render; it was the detector. We
swapped it for a frequency-bounded one, re-ran, and the logs showed real notes.
A second pass of logs revealed the screen was being *starved* (waveform only
painted on stop), so we moved detection to ~10 Hz to free the thread.

**The lesson:** with live logs, you replace three guesses with one fact per
round. That's the whole method. Instrument → read → fix → repeat.

### Tips

- **Tag every log** (`[pitch]`, `[audio]`) so the AI can grep the stream.
- **Throttle high-frequency logs** (1 in N) or they flood and themselves cause lag.
- **Log the decision inputs**, not just "got here" — the actual values (level,
  frequency, lengths, booleans). Values reveal causes; "reached line 40" doesn't.
- **Remove all temp logs before shipping** (tag them `// TEMP DIAGNOSTIC`).

## Gotchas

- **Native code changes need a new build.** Editing JavaScript hot-reloads.
  Editing native code (Kotlin/Swift, or adding a native library) requires a
  fresh `eas build` — the dev client only swaps JS, not native.
- **Dev mode ≠ real speed.** Things that lag in dev mode are often smooth in a
  preview APK. Don't optimise blindly against dev-mode slowness.
- **`console.log` at high frequency floods and itself causes lag.** Throttle it
  (log 1 in N), and remove it before shipping.
- **LAN, not internet.** The phone reaches Metro over local wifi. No data leaves
  the network unless you use `--tunnel`.
