import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChordDiagram } from '../components/ChordDiagram';
import { Segmented } from '../components/Segmented';
import { SongChartPanel } from '../components/SongChartPanel';
import { getVoicings } from '../utils/chords';
import {
  deleteSession,
  deleteSong,
  logSession,
  minutesOn,
  sessionsForSong,
  songChords,
  songProgressions,
  STATUS_LABEL,
  STATUS_ORDER,
  today,
  totalMinutes,
  updateSong
} from '../utils/library';
import type { Song, SongStatus } from '../utils/library';
import { capoLabel, chordShape } from '../utils/songText';

interface SessionDraft {
  minutes: string;
  chordsNote: string;
  strummingNote: string;
  singingNote: string;
  problemArea: string;
  nextAction: string;
}

interface SongPageProps {
  song: Song;
  onBack: () => void;
}

// The strumming patterns from the tracker's own reference sheet, offered when a
// song has none recorded yet. Suggestions, not defaults — nothing is written
// until one is chosen.
const PATTERN_IDEAS = ['D D D D', 'D D U U D U', 'D U D U', 'D - D U - U D U', 'D U x U D U'];

const fmtClock = (ms: number): string => {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const fmtDate = (iso: string): string =>
  new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

/** One chord, drawn if we can place it on a neck and named either way. */
const ChordCard: React.FC<{ symbol: string }> = ({ symbol }) => {
  const voicing = useMemo(() => {
    const shape = chordShape(symbol);
    if (!shape) return null;
    return getVoicings(shape.rootPc, shape.typeId, shape.rootName)[0] ?? null;
  }, [symbol]);

  return (
    <div className={`chordcard${voicing ? '' : ' is-plain'}`}>
      <span className="chordcard-name">{symbol}</span>
      {voicing
        ? <ChordDiagram frets={voicing.frets} fingers={voicing.fingers} scale={0.62} />
        : <span className="chordcard-note">no shape stored</span>}
    </div>
  );
};

export const SongPage: React.FC<SongPageProps> = ({ song, onBack }) => {
  const chords = songChords(song);
  const progressions = songProgressions(song);
  const sessions = sessionsForSong(song.id);
  const todayMinutes = minutesOn(song.id, today());
  const total = totalMinutes(song);

  // ---- the timer ---------------------------------------------------------
  // Wall-clock arithmetic rather than an accumulating counter: a background
  // tab throttles the interval, and a counter that ticks fewer times would
  // quietly log a shorter session than the one you actually played.
  const [runningSince, setRunningSince] = useState<number | null>(null);
  const [banked, setBanked] = useState(0);
  const [now, setNow] = useState(Date.now());
  const elapsed = banked + (runningSince ? now - runningSince : 0);

  useEffect(() => {
    if (!runningSince) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [runningSince]);

  const startedAt = useRef<number | null>(null);
  const start = () => {
    if (startedAt.current === null) startedAt.current = Date.now();
    setNow(Date.now());
    setRunningSince(Date.now());
  };
  const pause = () => {
    if (!runningSince) return;
    setBanked(b => b + (Date.now() - runningSince));
    setRunningSince(null);
  };

  // ---- the session being written ----------------------------------------
  const [form, setForm] = useState<SessionDraft | null>(null);

  const finish = () => {
    const ms = banked + (runningSince ? Date.now() - runningSince : 0);
    setRunningSince(null);
    setBanked(ms);
    setForm({
      // Under a minute still counts as a minute; a session that logs zero
      // reads as one that never happened.
      minutes: String(Math.max(1, Math.round(ms / 60000))),
      chordsNote: '',
      strummingNote: '',
      singingNote: '',
      problemArea: '',
      nextAction: ''
    });
  };

  const discard = () => {
    setForm(null);
    setBanked(0);
    startedAt.current = null;
  };

  const save = async () => {
    if (!form) return;
    await logSession({
      songId: song.id,
      minutes: Number(form.minutes) || 0,
      chordsNote: form.chordsNote,
      strummingNote: form.strummingNote,
      singingNote: form.singingNote,
      problemArea: form.problemArea,
      nextAction: form.nextAction,
      startedAt: startedAt.current ?? Date.now()
    });
    discard();
  };

  const field = (key: keyof SessionDraft, label: string, placeholder: string) => (
    <label className="song-field">
      <span className="field-label">{label}</span>
      <input
        className="text-field"
        value={form?.[key] ?? ''}
        placeholder={placeholder}
        onChange={e => setForm(f => (f ? { ...f, [key]: e.target.value } : f))}
      />
    </label>
  );

  // The notes box keeps a local draft and writes when it loses focus. Writing
  // through on every keystroke would put a store round-trip and a re-render of
  // the whole page between the key and the letter appearing.
  const [notesDraft, setNotesDraft] = useState(song.notes);
  useEffect(() => setNotesDraft(song.notes), [song.id, song.notes]);

  // Two steps, because this takes the practice log with it and there is no
  // undo. Quiet and last on the page — it is not something you should be able
  // to hit on the way to the timer.
  const [confirmDelete, setConfirmDelete] = useState(false);
  useEffect(() => setConfirmDelete(false), [song.id]);

  // The last session's next action is the one thing from the log worth putting
  // in front of you before you play rather than after.
  const lastAction = sessions.find(s => s.nextAction)?.nextAction;

  return (
    <div className="songpage">
      <button type="button" className="song-back" onClick={onBack}>
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
        </svg>
        Songs
      </button>

      <header className="song-head">
        <div>
          {song.day && <span className="song-day readout">Day {String(song.day).padStart(2, '0')}</span>}
          <h2 className="lab-title">{song.title}</h2>
          <p className="song-artist">{song.artist || 'Unknown artist'}</p>
          <p className="song-meta readout">
            {song.key || 'Key not set'} · {capoLabel(song.capo)}
          </p>
        </div>
        <div className="song-head-actions">
          <Segmented<SongStatus>
            value={song.status}
            onChange={status => void updateSong(song.id, { status })}
            options={STATUS_ORDER.map(s => ({ value: s, label: STATUS_LABEL[s] }))}
            ariaLabel="Song status"
            size="sm"
          />
          <button
            type="button"
            className={`revisit-toggle${song.revisit ? ' is-on' : ''}`}
            onClick={() => void updateSong(song.id, { revisit: !song.revisit })}
            aria-pressed={song.revisit}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 2v6h6" /><path d="M3.5 13a9 9 0 1 0 2.1-7.4L3 8" />
            </svg>
            Revisit
          </button>
        </div>
      </header>

      {lastAction && (
        <p className="song-carry">
          <span className="surface-label">Next action</span>
          {lastAction}
        </p>
      )}

      <div className="song-body">
        <section className="song-panel song-chords">
          <div className="surface-label">
            <span>Chords</span>
            <span className="readout">{chords.length}</span>
          </div>
          {chords.length > 0 ? (
            <div className="chordcards">
              {chords.map(c => <ChordCard key={c} symbol={c} />)}
            </div>
          ) : (
            <p className="song-empty">No chords recorded for this song yet.</p>
          )}

          {progressions.length > 0 && (
            <>
              <div className="surface-label song-subhead"><span>Progressions</span></div>
              <ol className="progression-list">
                {progressions.map((prog, i) => (
                  <li key={i}>
                    <span className="progression-index readout">{i + 1}</span>
                    <span className="progression-chords">
                      {prog.map((chord, j) => (
                        <React.Fragment key={j}>
                          {j > 0 && <span className="progression-arrow" aria-hidden="true">→</span>}
                          <span className="progression-chord readout">{chord}</span>
                        </React.Fragment>
                      ))}
                    </span>
                  </li>
                ))}
              </ol>
            </>
          )}
        </section>

        <div className="song-side">
          <section className="song-panel">
            <div className="surface-label"><span>Strumming</span></div>
            {song.strumming ? (
              <p className="strumming-pattern readout">{song.strumming}</p>
            ) : (
              <div className="strumming-pick">
                <p className="song-empty">Nothing recorded. Pick a pattern to start with:</p>
                <div className="strumming-ideas">
                  {PATTERN_IDEAS.map(p => (
                    <button
                      key={p}
                      type="button"
                      className="chip-btn readout"
                      onClick={() => void updateSong(song.id, { strumming: p })}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>

          <section className="song-panel">
            <div className="surface-label">
              <span>Confidence</span>
              <span className="readout">{song.confidence}/10</span>
            </div>
            <input
              type="range"
              min={0}
              max={10}
              step={1}
              value={song.confidence}
              className="confidence-range"
              aria-label="Confidence out of ten"
              onChange={e => void updateSong(song.id, { confidence: Number(e.target.value) })}
            />
            <div className="confidence-scale readout" aria-hidden="true">
              <span>0</span><span>5</span><span>10</span>
            </div>
          </section>

          <section className="song-panel song-minutes">
            <div className="surface-label"><span>Practice</span></div>
            <dl className="minute-pair">
              <div><dt>Today</dt><dd className="readout">{todayMinutes} min</dd></div>
              <div><dt>Total</dt><dd className="readout">{total} min</dd></div>
            </dl>
          </section>
        </div>
      </div>

      <SongChartPanel song={song} />

      <section className="song-panel practice-panel">
        <div className="surface-label">
          <span>Practice session</span>
          {sessions.length > 0 && <span className="readout">{sessions.length} logged</span>}
        </div>

        {!form ? (
          <div className="timer">
            <span className={`timer-clock readout${runningSince ? ' is-running' : ''}`}>{fmtClock(elapsed)}</span>
            <div className="timer-controls">
              {runningSince
                ? <button type="button" className="btn btn-secondary" onClick={pause}>Pause</button>
                : <button type="button" className="btn btn-primary" onClick={start}>{elapsed > 0 ? 'Resume' : 'Start practice'}</button>}
              <button type="button" className="btn" onClick={finish} disabled={elapsed < 1000}>Finish &amp; log</button>
              {elapsed > 0 && !runningSince && (
                <button type="button" className="btn timer-reset" onClick={discard}>Reset</button>
              )}
            </div>
          </div>
        ) : (
          <div className="session-form">
            <label className="song-field session-minutes">
              <span className="field-label">Minutes</span>
              <input
                className="text-field readout"
                inputMode="numeric"
                value={form.minutes}
                onChange={e => setForm(f => (f ? { ...f, minutes: e.target.value.replace(/\D/g, '') } : f))}
              />
            </label>
            {field('chordsNote', 'Chords / transitions', 'Which change kept breaking?')}
            {field('strummingNote', 'Strumming / picking', 'Pattern, tempo, hand feel')}
            {field('singingNote', 'Singing', 'Playing and singing together?')}
            {field('problemArea', 'Problem area', 'The bar that fell apart')}
            {field('nextAction', 'Next action', 'What to do first next time')}
            <div className="session-actions">
              <button type="button" className="btn btn-primary" onClick={() => void save()}>Log session</button>
              <button type="button" className="btn" onClick={discard}>Discard</button>
            </div>
          </div>
        )}

        {sessions.length > 0 && (
          <ol className="session-log">
            {sessions.map(s => (
              <li key={s.id} className="session-row">
                <span className="session-when readout">{fmtDate(s.date)}</span>
                <span className="session-num readout">#{s.sessionNumber}</span>
                <span className="session-mins readout">{s.minutes} min</span>
                <span className="session-notes">
                  {[s.problemArea && `Problem: ${s.problemArea}`, s.nextAction && `Next: ${s.nextAction}`,
                    s.chordsNote, s.strummingNote, s.singingNote]
                    .filter(Boolean).join(' · ') || 'No notes'}
                </span>
                <button
                  type="button"
                  className="session-delete"
                  title="Delete this session"
                  aria-label={`Delete session ${s.sessionNumber}`}
                  onClick={() => void deleteSession(s.id)}
                >
                  ×
                </button>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="song-panel">
        <div className="surface-label"><span>Notes</span></div>
        <textarea
          className="text-field song-notes"
          rows={3}
          placeholder="What you learned, what to watch for…"
          value={notesDraft}
          onChange={e => setNotesDraft(e.target.value)}
          onBlur={() => { if (notesDraft !== song.notes) void updateSong(song.id, { notes: notesDraft }); }}
        />
      </section>

      <div className="song-danger">
        {confirmDelete ? (
          <>
            <span>
              Delete “{song.title}” and its {sessions.length} logged {sessions.length === 1 ? 'session' : 'sessions'}?
            </span>
            <button type="button" className="btn song-delete" onClick={() => { void deleteSong(song.id); onBack(); }}>
              Delete
            </button>
            <button type="button" className="btn" onClick={() => setConfirmDelete(false)}>Keep it</button>
          </>
        ) : (
          <button type="button" className="song-delete-link" onClick={() => setConfirmDelete(true)}>
            Delete song
          </button>
        )}
      </div>
    </div>
  );
};

export default SongPage;
