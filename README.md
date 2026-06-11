# Slapback

**A live delayed vocal monitor for singers.**

Slapback feeds your microphone back through your earbuds with a short,
adjustable delay (150–1000 ms). Hearing yourself a beat behind makes it far
easier to lock in pitch and timing while you sing — you finish a phrase, hear it
land a moment later, and correct on the fly.

It's the same effect as the slight delay when you call your own number, but
tuned deliberately and controllable in real time.

---

## What it does

- Continuous **mic → delay → earbuds** monitoring while the button is on.
- A **delay slider** you can move while singing (150 ms to 1000 ms).
- An **echo-cancellation toggle** for speaker use.
- One screen. No accounts, no network, no nonsense.

---

## Requirements

- An **Android phone**.
- **Wired or low-latency earbuds strongly recommended.** With earbuds the
  speaker can't feed back into the mic, so you get clean sound and no howl.

---

## Install (the easy way)

1. Download the latest `slapback.apk` from the
   [Releases](../../releases) page.
2. On your phone, open the file. If prompted, allow
   *Install unknown apps* for your browser or file manager.
3. Tap **Install**, then open Slapback.
4. Plug in earbuds, press **START**, and sing.

---

## Usage

1. Put in your earbuds.
2. Press the big **START** button.
3. Set the **Delay** slider to taste — start around 300 ms.
4. Sing. You'll hear yourself a beat late; adjust your pitch and timing to it.
5. Leave **Echo Cancellation** off when using earbuds for the cleanest sound.
   Turn it on only if you're using the phone's loudspeaker.

---

## Build from source

You'll need [Node.js](https://nodejs.org), the
[Expo CLI](https://docs.expo.dev), and a free
[Expo account](https://expo.dev) for cloud builds.

```bash
# 1. Get the dependencies
npm install

# 2. (One time) build a development client APK and install it on your phone
eas build --profile development --platform android
#    install the resulting APK, then start the live-reload dev server:
npx expo start --dev-client

# 3. Build a shareable standalone APK
eas build --profile preview --platform android
#    EAS returns a download link to slapback.apk — sideload it onto any phone.
```

> This app uses native audio, so it does **not** run in Expo Go. Use a
> development build or the standalone APK above.

---

## How it works

The signal path is dead simple:

```
microphone → delay buffer → earbuds / speaker
```

The code is split into three clear layers — the screen, a small control hook,
and a single audio-engine module that is the only thing touching the mic and
speaker. See [`docs/CONTEXT.md`](docs/CONTEXT.md) for the full architecture.

Built with [Expo](https://expo.dev) and
[react-native-audio-api](https://github.com/software-mansion/react-native-audio-api).

---

## License

MIT — see [LICENSE](LICENSE).
