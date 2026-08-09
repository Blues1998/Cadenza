import React, { useMemo, useState } from 'react';
import { Keyboard } from '../components/Keyboard';
import { Fretboard } from '../components/Fretboard';
import { NoteHighway } from '../components/NoteHighway';
import { audio } from '../utils/audio';
import { noteNameToMidi, chordShapeMidis, GUITAR_CHORD_SHAPES } from '../utils/musicTheory';
import { SONG_CHARTS } from '../data/songCharts';
import { useSongChart } from '../hooks/useSongChart';
import type { JudgedEvent } from '../hooks/useSongChart';
import { useComputerKeyboardInstrument, SEMITONE_TO_KEY } from '../hooks/useComputerKeyboardInstrument';
import { useGuitarChordKeyboard } from '../hooks/useGuitarChordKeyboard';
import { IconPlay, IconStop } from '../components/Icons';

export const SongHeroLab: React.FC = () => {
  const [selectedId, setSelectedId] = useState(SONG_CHARTS[0].id);
  const chart = SONG_CHARTS.find(c => c.id === selectedId) ?? SONG_CHARTS[0];

  const { phase, mode: sessionMode, events, summary, start, stop, reportInput } = useSongChart(chart);
  const [activeMidis, setActiveMidis] = useState<number[]>([]);

  const isSessionActive = phase === 'countin' || phase === 'playing';
  const listeningNow = isSessionActive && sessionMode === 'listen';

  // Shared by both instruments: always plays the note/chord's sound and
  // flashes it on the Keyboard/Fretboard (same pattern TheoryLab uses),
  // and — reportInput no-ops on its own outside an active Play session —
  // always reports it for grading too, so callers don't need to gate this.
  const handlePlayNote = (midi: number, chordId?: string | null) => {
    audio.playMidi(midi, 1.2);
    setActiveMidis(prev => (prev.includes(midi) ? prev : [...prev, midi]));
    setTimeout(() => {
      setActiveMidis(prev => prev.filter(m => m !== midi));
    }, 150);
    reportInput(chart.instrument === 'guitar' ? { kind: 'guitar', chordId: chordId ?? null } : { kind: 'piano', midi });
  };

  const { setOctave } = useComputerKeyboardInstrument(handlePlayNote, chart.instrument === 'piano' && !listeningNow);
  useGuitarChordKeyboard(handlePlayNote, chart.instrument === 'guitar' && !listeningNow);

  const handleSelect = (id: string) => {
    stop();
    setActiveMidis([]);
    setSelectedId(id);
  };

  const handleStart = (startMode: 'listen' | 'play') => {
    setActiveMidis([]);
    if (chart.instrument === 'piano') setOctave(chart.homeOctave);
    start(startMode);
  };

  // Root MIDI of the chart's locked octave window, e.g. homeOctave=4 -> C4=60 —
  // used to turn a piano event's raw MIDI back into "which key plays it."
  const homeOctaveRoot = chart.instrument === 'piano' ? (chart.homeOctave + 1) * 12 : 0;

  const keyLabelFor = (e: JudgedEvent): string => {
    if (e.kind === 'piano') {
      return SEMITONE_TO_KEY[e.midi - homeOctaveRoot] ?? '?';
    }
    const idx = GUITAR_CHORD_SHAPES.findIndex(s => s.id === e.chordId);
    return idx === -1 ? '?' : String(idx + 1);
  };

  const nextEvent = events.find(e => e.rating === null) ?? null;
  const previewMidis = !nextEvent ? [] : nextEvent.kind === 'piano' ? [nextEvent.midi] : chordShapeMidis(nextEvent.chordId);

  const midiRange = useMemo(() => {
    if (chart.instrument !== 'piano') return { min: 0, max: 12 };
    const midis = chart.notes.map(n => noteNameToMidi(n.noteName, n.octave));
    return { min: Math.min(...midis), max: Math.max(...midis) };
  }, [chart]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div className="lab-header">
        <h2 className="lab-title">Song Hero</h2>
        <p className="lab-description">
          Play real songs on your keyboard — watch the highway scroll toward the line, hit the right key at the right time.
        </p>
      </div>

      <div className="grid-2">
        {SONG_CHARTS.map(s => (
          <div
            key={s.id}
            className={`glass-card ${s.id === selectedId ? 'active' : ''}`}
            onClick={() => handleSelect(s.id)}
          >
            <h4 style={{ marginBottom: '0.25rem' }}>{s.title}</h4>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{s.subtitle}</p>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
              {s.instrument === 'piano' ? '🎹 Piano' : '🎸 Guitar'} · {s.bpm} BPM
            </p>
          </div>
        ))}
      </div>

      <section className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div>
          <h3 style={{ fontSize: '1.15rem' }}>{chart.title}</h3>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>{chart.subtitle}</p>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>⚠ {chart.sourceNote}</p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button className="btn" onClick={() => handleStart('listen')} disabled={isSessionActive} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
            <IconPlay /> Listen
          </button>
          <button className="btn btn-primary" onClick={() => handleStart('play')} disabled={isSessionActive} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
            <IconPlay /> Play
          </button>
          {isSessionActive && (
            <button className="btn" onClick={stop} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
              <IconStop /> Stop
            </button>
          )}
        </div>

        {isSessionActive && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                {phase === 'countin' ? 'Get ready…' : listeningNow ? 'Listening…' : 'Your turn — press the highlighted key'}
              </div>
              {!listeningNow && nextEvent && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Next:</span>
                  <kbd className="key-hint" style={{ fontSize: '1.1rem', padding: '4px 12px' }}>
                    {keyLabelFor(nextEvent)}
                  </kbd>
                </div>
              )}
            </div>
            <NoteHighway events={events} minMidi={midiRange.min} maxMidi={midiRange.max} keyLabelFor={keyLabelFor} />
          </>
        )}

        {summary && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '1rem', borderRadius: '10px', background: 'rgba(var(--surface-tint-rgb),0.04)', border: '1px solid rgba(var(--surface-tint-rgb),0.08)' }}>
            <strong style={{ fontSize: '1.1rem' }}>Score: {summary.accuracyPct}%</strong>
            <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              <span>Perfect: <strong style={{ color: 'var(--success)' }}>{summary.perfect}</strong></span>
              <span>Good: <strong style={{ color: 'var(--primary)' }}>{summary.good}</strong></span>
              <span>Imprecise: <strong style={{ color: 'var(--warning)' }}>{summary.imprecise}</strong></span>
              <span>Miss: <strong style={{ color: 'var(--danger)' }}>{summary.miss}</strong></span>
              <span>Best streak: <strong>{summary.bestStreak}</strong></span>
            </div>
          </div>
        )}
      </section>

      {chart.instrument === 'piano' ? (
        <Keyboard activeMidis={activeMidis} highlightCorrectMidis={previewMidis} onPlayNote={handlePlayNote} />
      ) : (
        <Fretboard activeMidis={activeMidis} highlightCorrectMidis={previewMidis} onPlayNote={handlePlayNote} showAllNoteNames />
      )}
    </div>
  );
};
export default SongHeroLab;
