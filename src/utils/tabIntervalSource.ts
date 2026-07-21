// Extracts real melodic interval "jumps" from a parsed Guitar Pro/MusicXML
// score, so the Ear Training lab can quiz on actual note-to-note movements
// from a piece someone is learning instead of only randomly generated tones.
import type { model } from '@coderline/alphatab';

export interface TabIntervalCandidate {
  startTick: number;
  endTick: number;
  fromMidi: number;
  toMidi: number;
  barNumber: number; // 1-based, for display
}

// Only single-note-per-beat melodic motion counts as a candidate — a beat
// that's a rest or a chord breaks the chain, so we don't end up quizzing on
// a "jump" between two notes of an arpeggiated chord or across a silence.
export function extractIntervalCandidates(score: model.Score): TabIntervalCandidate[] {
  const staff = score.tracks[0]?.staves[0];
  if (!staff) return [];

  const candidates: TabIntervalCandidate[] = [];
  let prev: { note: model.Note; beat: model.Beat } | null = null;

  for (const bar of staff.bars) {
    const voice = bar.voices[0];
    if (!voice) continue;
    for (const beat of voice.beats) {
      if (beat.isRest || beat.notes.length !== 1) {
        prev = null;
        continue;
      }
      const note = beat.notes[0];
      if (prev) {
        const semitones = Math.abs(note.realValue - prev.note.realValue);
        // Capped at an octave to match the Ear Training lab's interval list,
        // which only covers Unison through Octave (no compound intervals).
        if (semitones <= 12) {
          candidates.push({
            startTick: prev.beat.absolutePlaybackStart,
            endTick: beat.absolutePlaybackStart + beat.playbackDuration,
            fromMidi: prev.note.realValue,
            toMidi: note.realValue,
            barNumber: bar.index + 1
          });
        }
      }
      prev = { note, beat };
    }
  }
  return candidates;
}
