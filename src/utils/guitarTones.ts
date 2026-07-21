// Shared guitar soundfont/tone setup, used by both the Tab Player lab and
// anything else that needs alphaTab to play back real guitar sound (e.g.
// the Ear Training lab's "practice from my tabs" mode).
import { model } from '@coderline/alphatab';

// Real recorded classical/steel guitar samples (4 velocity layers + fret
// noise) from the "Nylon and Steel Guitars-4U" soundfont (soundfonts4u,
// CC BY-NC-SA 4.0), which sounds far less robotic than the default GM patch.
// Its presets were rebanked from 0 to 1 (see scripts/fetch-guitar-soundfont.mjs)
// purely to avoid colliding with the base soundfont's bank-0 GM programs
// 0-6 (pianos) when both are loaded together.
export const GUITAR_SOUNDFONT_URL = '/instruments/soundfonts4u-nylon-steel-guitars-bank1.sf2';

export interface GuitarTone {
  bank: number;
  program: number;
  label: string;
}

export const GUITAR_TONES: GuitarTone[] = [
  { bank: 1, program: 0, label: 'Nylon Classical' },
  { bank: 1, program: 1, label: 'Nylon (No Fret Noise)' },
  { bank: 1, program: 2, label: 'Nylon Smooth' },
  { bank: 1, program: 3, label: 'Steel-String Acoustic' },
  { bank: 1, program: 4, label: 'Chorus Guitar' },
  { bank: 1, program: 5, label: 'Clean Electric' },
  { bank: 1, program: 6, label: '12-String Guitar' }
];
export const DEFAULT_GUITAR_TONE = GUITAR_TONES[0]; // Nylon Classical

export function toneKey(bank: number, program: number): string {
  return `${bank}:${program}`;
}

// alphaTab bakes the instrument into an "automation" event on each track's
// very first beat the first time it's accessed (during initial rendering) —
// after that, changing track.playbackInfo.program alone does nothing, since
// playback always reads that frozen first-beat automation. Update both.
// (Bank has no such freeze, so a plain property set is enough for it.)
export function setScoreInstrument(score: model.Score, bank: number, program: number) {
  score.tracks.forEach(track => {
    track.playbackInfo.bank = bank;
    track.playbackInfo.program = program;
    const firstBeat = track.staves[0]?.bars[0]?.voices[0]?.beats[0];
    if (!firstBeat) return;
    const existing = firstBeat.getAutomation(model.AutomationType.Instrument);
    if (existing) {
      existing.value = program;
    } else {
      firstBeat.automations.push(model.Automation.buildInstrumentAutomation(false, 0, program));
    }
  });
}
