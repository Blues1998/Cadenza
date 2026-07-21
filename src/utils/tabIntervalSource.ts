// Extracts real melodic interval "jumps" from a parsed Guitar Pro/MusicXML
// score, so the Ear Training lab can quiz on actual note-to-note movements
// from a piece someone is learning instead of only randomly generated tones.
import type { model, midi } from '@coderline/alphatab';

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
//
// beat.absolutePlaybackStart is a *structural* tick position — it ignores
// repeat signs entirely, since a MasterBar only exists once in the score
// regardless of how many times it's actually played. The synth's real
// playback ticks (what api.playbackRange/tickPosition operate on) come from
// the repeat-EXPANDED MIDI timeline instead, so for any piece with a repeat
// before a candidate, the structural tick and the real playback tick point
// at different places in the song — using the structural one here made
// api.play() play whatever those tick numbers actually landed on elsewhere
// in the piece, not the analyzed note pair. tickCache (built from the
// generated MIDI, so it must be read after loadMidiForScore() resolves)
// gives the tick of each beat's first real playback occurrence instead.
export function extractIntervalCandidates(score: model.Score, tickCache: midi.MidiTickLookup | null): TabIntervalCandidate[] {
  const staff = score.tracks[0]?.staves[0];
  if (!staff) return [];

  const beatStart = (beat: model.Beat) => tickCache?.getBeatStart(beat) ?? beat.absolutePlaybackStart;

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
          const startTick = beatStart(prev.beat);
          const endTick = beatStart(beat) + beat.playbackDuration;
          // Guards against an out-of-order tick pair from an unusual repeat
          // structure (e.g. alternate endings) producing an unplayable range.
          if (endTick > startTick) {
            candidates.push({
              startTick,
              endTick,
              fromMidi: prev.note.realValue,
              toMidi: note.realValue,
              barNumber: bar.index + 1
            });
          }
        }
      }
      prev = { note, beat };
    }
  }
  return candidates;
}
