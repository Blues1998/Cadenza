# Guitar bank

Builds `public/instruments/cadenza-guitars.sf3`, the guitar sounds the Tab Player
and Ear Training play through alphaTab.

Every recording in it is CC0, so it can ship in a paid app with no credit
required:

| Preset (bank 1) | Program | Source |
|---|---|---|
| Nylon | 0 | [Meta Nylon Guitar](https://github.com/facebookincubator/Meta-open-sound/releases/tag/meta-nylon-guitar-v1.0.0), light pick, firm pick from velocity 103 |
| Nylon fingerstyle | 1 | Meta Nylon Guitar, fingerstyle |
| Steel acoustic | 3 | [Meta Steel Guitar](https://github.com/facebookincubator/Meta-open-sound/releases/tag/meta-steel-guitar-v1.0.0), medium, hard from velocity 103 |
| Chorus electric | 4 | [FreePats FSBS Electric Guitar Clean](https://freepats.zenvoid.org/ElectricGuitar/clean-electric-guitar.html), two voices 7 cents apart, panned |
| Clean electric | 5 | FreePats FSBS Electric Guitar Clean |
| 12-string | 6 | Meta Steel Guitar: octave courses on E A D G, unison courses on B E, each partner a separate recording |

## Rebuild

```sh
brew install vorbis-tools sevenzip
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
./fetch.sh                    # about 1.2 GB into ./work
.venv/bin/python make_bank.py # writes public/instruments/cadenza-guitars.sf3
```

## What the build does to each note

- Mixes to mono. alphaTab only plays mono samples, and the stereo pairs here are near identical.
- Trims lead silence, so notes land on the beat.
- Measures the fundamental and writes a pitch correction, so every note is within 2 cents.
- Fades out once the note has decayed 50 dB (at most 6 s for low notes, 4.5 s otherwise).
- Resamples to 36 kHz and encodes Ogg Vorbis (SF3), which keeps the file around 11 MB.
- Levels each note against its velocity layer by A-weighted loudness, and limits peaks where needed.

The levels are matched to the previous bank as heard through alphaTab, within 1 dB.

The SF3 sample chunk is kept an even length on purpose: alphaTab does not skip
the RIFF pad byte, and an odd chunk makes it reject the whole bank.
