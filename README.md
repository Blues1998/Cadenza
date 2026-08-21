# Cadenza

An interactive music theory companion that teaches by ear and by hand rather
than by diagram. It listens to your microphone, plays back what it is talking
about, and tracks what you have actually done.

**[Open it](https://blues1998.github.io/Cadenza/)**

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
npm run setup:soundfont   # optional, see below
npm run dev               # vite dev server
npm run build             # tsc -b && vite build
npm run lint              # oxlint
```

`setup:soundfont` downloads the ~37 MB guitar soundfont used by the Tab Player
and rebanks its presets from bank 0 to bank 1 so they cannot collide with the
base General MIDI soundfont's piano programs. The file is too large to commit,
so it is gitignored and this script recreates it on a fresh clone. Everything
except realistic Tab Player tones works without it.

## Built with

React 19, TypeScript, Vite, the Web Audio API for synthesis and analysis, and
[alphaTab](https://alphatab.net/) for tablature rendering and playback. No UI
framework and no state library.

Deployed to GitHub Pages by the workflow in `.github/workflows/deploy.yml` on
push to `main`.

## Credits

Guitar tones use the "Nylon and Steel Guitars-4U" soundfont from
[Soundfonts4U](https://huggingface.co/datasets/projectlosangeles/soundfonts4u),
licensed CC BY-NC-SA 4.0.

## License

MIT. See [LICENSE](LICENSE).
