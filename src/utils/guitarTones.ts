// Shared guitar soundfont/tone setup, used by both the Tab Player lab and
// anything else that needs alphaTab to play back real guitar sound (e.g.
// the Ear Training lab's "practice from my tabs" mode).
import { model } from '@coderline/alphatab';
import { assetUrl } from './assetUrl';

// Recorded guitars, all CC0 (free for any use, including paid apps):
//   Meta Nylon Guitar and Meta Steel Guitar (Meta Open Sound)
//   FSBS Electric Guitar Clean (FreePats)
// Built into one SF3 bank by scripts/guitar-bank (see its README). Presets sit
// in bank 1 so they never collide with the base soundfont's bank-0 programs.
export const GUITAR_SOUNDFONT_URL = assetUrl('instruments/cadenza-guitars.sf3');

export interface GuitarTone {
  bank: number;
  program: number;
  label: string;
}

export const GUITAR_TONES: GuitarTone[] = [
  { bank: 1, program: 0, label: 'Nylon' },
  { bank: 1, program: 1, label: 'Nylon fingerstyle' },
  { bank: 1, program: 3, label: 'Steel acoustic' },
  { bank: 1, program: 6, label: '12-string' },
  { bank: 1, program: 5, label: 'Clean electric' },
  { bank: 1, program: 4, label: 'Chorus electric' }
];
export const DEFAULT_GUITAR_TONE = GUITAR_TONES[0]; // Nylon

/** The saved tone if this bank still has it, otherwise the default. */
export function knownTone(saved?: { bank: number; program: number } | null): GuitarTone {
  return GUITAR_TONES.find(t => saved && t.bank === saved.bank && t.program === saved.program) ?? DEFAULT_GUITAR_TONE;
}

export function toneKey(bank: number, program: number): string {
  return `${bank}:${program}`;
}

// alphaTab bakes the instrument into an "automation" event on each track's
// very first beat the first time it's accessed (during initial rendering),
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
