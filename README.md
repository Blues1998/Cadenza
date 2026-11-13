# Sharps&Flats

An interactive music theory companion that teaches by ear and by hand rather
than by diagram. It listens to your microphone, plays back what it is talking
about, and tracks what you have actually done.

**[Open it](https://blues1998.github.io/sharps-and-flats/)**

## What is in it

Nine sections, reachable from the sidebar in any order:

| Section | What it does |
| --- | --- |
| **Dashboard** | The Guided Journey: a linear beginner curriculum that strings the other labs together. Each level is one plain-English idea plus one concrete task, and completes itself when the lab reports the required progress. |
| **Ear Training** | Interval and chord recognition drills. |
| **Theory & Scales** | Circle of fifths, scale families, and the relationships between them. |
| **Play Challenges** | Timed exercises against the fretboard and keyboard. |
| **Sound Physics** | A harmonic series explorer. Build a waveform from its overtones and hear the exact stack you assembled, which is where the difference between a guitar and a flute actually lives. |
| **Rhythm Lab** | Meter, subdivision, and timing practice. |
| **Pitch & Tuner** | Real-time pitch detection from the microphone, plus a practice game that scores how close to the target you land in cents. |
| **Tab Player** | Guitar tablature rendered and played back through alphaTab with a real guitar soundfont. |
| **Song Hero** | A keyboard-driven note highway for playing along with real songs. |

Light and dark themes, a collapsible sidebar, and progress that persists in
`localStorage`.

## Running it locally

```sh
npm install
npm run dev               # vite dev server
npm run build             # tsc -b && vite build
npm run lint              # oxlint
```

## Android app

The Android app wraps the same build with [Capacitor](https://capacitorjs.com). The site is bundled into the app, so it works offline. The native project is in `android/`.

```bash
npm run build:android   # builds with base "/" and copies it into android/
npm run android:open    # opens the project in Android Studio
```

Android Studio provides the Java runtime and Gradle it needs.

**Play Store release:** `npm run release:android` writes a signed `.aab` (to upload) and a signed `.apk` (to test on a phone) into `release/`. It signs with the upload key named in `android/keystore.properties`, which lives outside the repo; back up the key and its password. Raise `versionCode` in `android/app/build.gradle` before every upload. The version name comes from `package.json`. `*.jks`, `*.keystore`, `keystore.properties` and `release/` are git-ignored.

- **No accounts on Android:** sign-in and cloud backup are website-only (`ACCOUNTS_ENABLED` in `src/utils/nativeShell.ts`), so the app sends nothing anywhere. The privacy policy is `public/privacy.html`.

- **App ID:** `io.github.blues1998.cadenza`. It can't be changed once the app is published.
- **Icons and splash screen:** generated from the images in `assets/` with `npx capacitor-assets generate --android --iconBackgroundColor '#00000d' --splashBackgroundColor '#00000d'`. The logo and the cropped ♯♭ mark they come from are in `design/brand/`.
- **Microphone:** `RECORD_AUDIO` is declared in the manifest. Android asks for it the first time the tuner listens.
- **Account deletion:** Google Play requires it. It uses the `delete_my_account` database function in `supabase/migrations/`, which has to be run once in the Supabase SQL editor. The web link for it is `https://blues1998.github.io/sharps-and-flats/?account`.

## Where things are

```
public/          served as-is at the site root
  brand/         the app icon, at the sizes browsers and phones ask for
  img/           images the app loads at runtime
  font/          \ copied from alphaTab at dev/build time, gitignored
  soundfont/     /
  instruments/   the guitar bank, built by scripts/guitar-bank
src/             the app
design/          full-size sources for everything in public/, never shipped
reference/       local working material, gitignored (Guitar Pro tab files)
```

Code reaches anything under `public/` through `assetUrl()`, which prefixes
Vite's `BASE_URL`: the site is served from `/sharps-and-flats/` on Pages and from `/`
in dev, so a bare absolute path would work in exactly one of those. The links
in `index.html` are the exception, Vite rewrites those itself at build time.

## Built with

React 19, TypeScript, Vite, the Web Audio API for synthesis and analysis, and
[alphaTab](https://alphatab.net/) for tablature rendering and playback. No UI
framework and no state library.

Deployed to GitHub Pages by the workflow in `.github/workflows/deploy.yml` on
push to `main`.

## Credits

Guitar sounds are built from CC0 recordings: Meta Nylon Guitar and Meta Steel
Guitar from [Meta Open Sound](https://github.com/facebookincubator/Meta-open-sound),
and FSBS Electric Guitar Clean from [FreePats](https://freepats.zenvoid.org/).
See `scripts/guitar-bank`.

## License

MIT. See [LICENSE](LICENSE).
