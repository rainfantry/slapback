# Slapback — Context & Handoff

> This document is for two audiences: **the owner** (a beginner who wants to
> understand and change the app) and **any AI or developer** who picks this
> repo up cold and needs the full picture fast. Read this first.

---

## 1. What this app is

Slapback is a **live delayed vocal monitor** for singers. You sing into the
phone's microphone, and the app plays your voice back through the
speaker/earbuds **a fraction of a second late** (an adjustable 150–1000 ms).
Hearing yourself a beat behind lets you correct pitch and timing on the fly —
like the slight delay you hear when you call your own number, but tuned on
purpose. It runs continuously while the button is on.

It is an **Android-first standalone app** (an installable `.apk`). It is **not**
an Expo Go app — it uses native audio code, which Expo Go can't load.

---

## 2. How it's wired (the mental model)

The app is built in three layers, each only talking to the one below it:

```
  MonitorScreen.js   ← the screen you see and touch (buttons, slider, switch)
        │  (reads values, calls actions)
        ▼
  useDelayMonitor.js ← the "middleman" hook: holds the numbers, handles
        │              start/stop, slider throttling, app-background cleanup
        ▼
  audioEngine.js     ← THE ONLY file that touches the mic & speaker.
                       Builds: mic → delay buffer → speaker, using the
                       react-native-audio-api library.
```

**The golden rule:** the screen never touches audio directly. If you ever swap
the audio library, you only rewrite `audioEngine.js`. Nothing else changes.

The sound path inside the engine:

```
  MICROPHONE → (recorder adapter / bridge) → DELAY BUFFER → SPEAKER / EARBUDS
```

---

## 3. Where everything lives

| File | What it does |
|------|--------------|
| `index.js` | Expo's entry point. Hands control to `App.js`. (From the template.) |
| `App.js` | Puts the one screen on the display and sets a dark status bar. |
| `src/screens/MonitorScreen.js` | The entire UI: title, big Start/Stop button, status line, delay slider, echo-cancel switch. Display only — no audio logic. |
| `src/hooks/useDelayMonitor.js` | The middleman. Remembers delay/echo/status, exposes `toggle()`, `changeDelay()`, `changeEcho()`. Stops the mic when the app is backgrounded or closed. |
| `src/audio/audioEngine.js` | **The audio boundary.** The only file that opens the mic/speaker. Exposes `start / stop / setDelay / setEchoCancel / getStatus`. |
| `src/theme.js` | All colours and sizes in one place. |
| `app.json` | App name, Android package id (`com.rainfantry.slapback`), microphone permission, and the `react-native-audio-api` config plugin. |
| `eas.json` | Build recipes. The `preview` profile outputs a sideloadable `.apk`. |
| `package.json` | Lists the libraries the app depends on. |
| `docs/CONTEXT.md` | This file. |
| `README.md` | The public-facing project description. |

---

## 4. The audio-engine contract

`audioEngine.js` is the swappable core. Its public functions:

```js
start({ delayMs, echoCancel })  // open mic, build mic→delay→speaker, begin
stop()                          // stop playback, release mic & audio session
setDelay(ms)                    // change delay LIVE (never rebuilds the chain)
setEchoCancel(enabled)          // toggle OS echo cancellation (restarts if live)
getStatus()                     // 'idle' | 'starting' | 'running' | 'error'
onStatusChange(fn)              // subscribe to status updates (fn(status))
getLastError()                  // last error message string, or null
```

Anything that can build the mic→delay→speaker path and honour these signatures
can replace the current implementation.

---

## 5. What's done vs. what to verify

- **Done & final:** the screen, the hook, the theme, app config, build config,
  docs. The app's structure and UX are complete.
- **Verify on first real build:** the exact `react-native-audio-api` method
  names in `audioEngine.js` (`createDelay`, `createRecorderAdapter`,
  `AudioRecorder`, `AudioManager.setAudioSessionOptions`). These match
  v0.12.x of the library. If a newer version renames anything, fix it **only**
  in `audioEngine.js`. Check the live docs:
  <https://docs.swmansion.com/react-native-audio-api/>

---

## 6. How to run it

See the **Build from source** section of `README.md` for the full command list.
Short version:

```bash
npm install                                  # get the libraries
eas build --profile development -p android   # one-time dev-client APK (cloud)
# install that APK on the phone, then:
npx expo start --dev-client                  # live-reload your code
```

For a shareable standalone app:

```bash
eas build --profile preview -p android       # outputs a sideloadable .apk
```

---

## 7. Known constraints (read before judging behaviour)

- **Android-first.** iOS would build too, but echo cancellation is wired for
  iOS call-mode; Android is the target.
- **No Expo Go.** Native audio = you must use a dev build or the standalone APK.
- **Echo cancellation is limited on Android.** The audio library does not yet
  expose Android's hardware echo canceller (as of v0.12.x). On iPhone the
  `voiceChat` session mode enables it; on Android the toggle is best-effort.
  **The reliable fix for feedback howl on Android is earbuds.** With earbuds the
  speaker never reaches the mic, so there's no loop to cancel — turn echo
  cancellation OFF for the cleanest sound.
- **Background = mic off.** By design, switching away from the app stops the
  monitor (no hidden hot mic). Press Start again when you return.
- **Delay floor of 150 ms** leaves headroom above the phone's own built-in
  audio latency, so the delay you set is roughly the delay you hear.

---

## 8. Glossary (for the non-coder)

- **Delay buffer** — a tiny holding pen that keeps your sound for X
  milliseconds before releasing it. Bigger X = you hear yourself later.
- **Echo cancellation (AEC)** — a trick that subtracts the speaker's sound out
  of the mic so you don't get a howling feedback loop. The same thing
  speakerphone calls use.
- **Latency** — the unavoidable tiny lag any phone adds between mic and speaker.
- **Sideload** — installing an app from an `.apk` file directly, instead of
  from the Play Store.
- **EAS** — Expo's cloud build service that turns this code into an `.apk`.
- **Dev client** — a special build of the app that lets your code reload
  instantly while you work, without rebuilding every time.
