import React, { useEffect, useRef, useState } from 'react';
import { ChordCard } from '../components/ChordCard';
import { FitPanel } from '../components/FitPanel';
import { VoicePanel } from '../components/VoicePanel';
import { IconBest, IconPlay, IconSection } from '../components/Icons';
import { SongChartPanel, type ChartMode } from '../components/SongChartPanel';
import { tally } from '../utils/chordbook';
import { go } from '../hooks/useRoute';
import { handLoop } from '../utils/handoff';
import { drillReason, songDrill, type SongDrill } from '../utils/songDrill';
import {
  deleteSession,
  deleteSong,
  logSession,
  sessionsForSong,
  songChords,
  STATUS_LABEL,
  STATUS_ORDER,
  totalMinutes,
  updateSong
} from '../utils/library';
import type { Song, SongStatus } from '../utils/library';
import { capoLabel } from '../utils/songText';
import { feel } from '../utils/haptics';
import { DEFAULT_CHART } from '../utils/chart';

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

// One page, three jobs: play the song, work on its chords, keep track of how
// it is going. The player docks at the bottom and keeps going across all three.
type SongTab = 'play' | 'chords' | 'progress';

const TABS: { id: SongTab; label: string }[] = [
  { id: 'play', label: 'Play' },
  { id: 'chords', label: 'Chords' },
  { id: 'progress', label: 'Progress' }
];

const fmtClock = (ms: number): string => {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const fmtDate = (iso: string): string =>
  new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

export const SongPage: React.FC<SongPageProps> = ({ song, onBack }) => {
  const chords = songChords(song);
  // Shown as "4 of 5 in your hands", the question you actually have when you
  // open a song you have not played in a fortnight.
  const chordStanding = tally(chords);
  // Recomputed every render rather than memoised on the song: rating a chord
  // on this very page changes which progression is the one in the way, and the
  // chord book is a different store, the song object it would be keyed on
  // never moves.
  const drill = songDrill(song);
  const sessions = sessionsForSong(song.id);
  const total = totalMinutes(song);

  const [tab, setTab] = useState<SongTab>('play');
  const [chartMode, setChartMode] = useState<ChartMode>('play');
  useEffect(() => { setTab('play'); setChartMode('play'); }, [song.id]);
  // Where the chart panel docks its player: the end of the page, so it can
  // stick to the bottom of the screen whichever tab is open.
  const [dock, setDock] = useState<HTMLDivElement | null>(null);

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

  // The last session's next action is the one thing from the log worth putting
  // in front of you before you play rather than after.
  const lastAction = sessions.find(s => s.nextAction)?.nextAction;

  // The changes, put where you can practise them. The loop goes over as an
  // intention rather than an address, the chord page picks it up, loads it
  // and spends it, so coming back here later does not re-load a drill over
  // whatever you had since built.
  const takeToDrill = (loop: SongDrill) => {
    handLoop({ slots: loop.slots, tempo: loop.tempo, beatsPerBar: loop.beatsPerBar, name: loop.name });
    go({ tab: 'chordbook', songId: null });
  };

  const openChart = (mode: ChartMode) => {
    setChartMode(mode);
    setTab('play');
  };

  return (
    <div className="songpage">
      <button type="button" className="song-back" onClick={onBack}>
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
        </svg>
        Songs
      </button>

      <header className="song-head">
        <div className="song-head-text">
          <h2 className="lab-title">{song.title}</h2>
          <p className="song-artist">{song.artist || 'Unknown artist'}</p>
          <div className="song-head-meta">
            <p className="song-meta readout">
              {song.key || 'Key not set'} · {capoLabel(song.capo)} · {song.chart?.tempo ?? DEFAULT_CHART.tempo} bpm · {song.chart?.beatsPerBar ?? DEFAULT_CHART.beatsPerBar}/4
            </p>
            <label className={`song-status is-${song.status}`}>
              <span className="song-status-dot" aria-hidden="true" />
              <select
                value={song.status}
                aria-label="Song status"
                onChange={e => {
                  const status = e.target.value as SongStatus;
                  if (status === 'complete' && song.status !== 'complete') feel('celebrate');
                  void updateSong(song.id, { status });
                }}
              >
                {STATUS_ORDER.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
              </select>
            </label>
            {song.revisit && <span className="song-revisit-badge">Revisit</span>}
          </div>
        </div>
        <SongMenu
          revisit={song.revisit}
          sessionCount={sessions.length}
          title={song.title}
          onEdit={() => openChart('edit')}
          onImport={() => openChart('import')}
          onRevisit={() => void updateSong(song.id, { revisit: !song.revisit })}
          onDelete={() => { void deleteSong(song.id); onBack(); }}
        />
      </header>

      {lastAction && (
        <p className="song-carry">
          <span className="song-carry-label">Next</span>
          {lastAction}
        </p>
      )}

      <div className="song-tabs" role="tablist" aria-label="Song">
        {TABS.map(t => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`song-tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`song-panel-${t.id}`}
            className={`song-tab${tab === t.id ? ' is-active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'chords' && (
        <div className="song-tabpanel" role="tabpanel" id="song-panel-chords" aria-labelledby="song-tab-chords">
          <section className="song-panel song-chords">
            <div className="surface-label">
              <IconSection kind="chords" /><span>Your chords</span>
              {chords.length > 0 && (
                <span className="readout">{chordStanding.solid + chordStanding.shaky} of {chords.length} in your hands</span>
              )}
            </div>
            {chords.length > 0 ? (
              <div className="chordcards">
                {chords.map(c => <ChordCard key={c} symbol={c} markable shapes />)}
              </div>
            ) : (
              <p className="song-empty">No chords yet. Add them under Edit chart in the ⋯ menu.</p>
            )}

            {/* The panel above says which chords are in the way. This is the
                thing to press about it. */}
            {drill && (
              <div className="song-drill">
                <span className="song-drill-text">
                  <span className="song-drill-title">Drill the changes</span>
                  <span className="song-drill-chords readout">
                    {drill.chords.map((chord, i) => (
                      <React.Fragment key={i}>
                        {i > 0 && <span className="progression-arrow" aria-hidden="true">→</span>}
                        {chord}
                      </React.Fragment>
                    ))}
                    <span className="song-drill-tempo" title={drill.held ? 'The fastest you have held this loop clean' : 'Slow enough to build the shape that is in the way'}>
                      {drill.held && <IconBest size={10} />}
                      {drill.tempo} bpm
                    </span>
                  </span>
                  <span className="song-drill-why">{drillReason(drill)}</span>
                </span>
                <button
                  type="button"
                  className="song-drill-go"
                  onClick={() => takeToDrill(drill)}
                  aria-label={`Drill these changes at ${drill.tempo} bpm`}
                  title={`Open the chord page with these bars loaded at ${drill.tempo} bpm`}
                >
                  <IconPlay size={14} />
                </button>
              </div>
            )}
          </section>

          <section className="song-panel song-easier">
            <div className="surface-label"><span>Make it easier</span></div>
            <details className="song-easier-row">
              <summary>
                <span>Capo for your hands<small>Pick a capo that puts the chords you know to work</small></span>
              </summary>
              <FitPanel song={song} />
            </details>
            <details className="song-easier-row">
              <summary>
                <span>Does it fit your voice?<small>Sing it once to check the key</small></span>
              </summary>
              <VoicePanel song={song} />
            </details>
          </section>
        </div>
      )}

      {tab === 'progress' && (
        <div className="song-tabpanel" role="tabpanel" id="song-panel-progress" aria-labelledby="song-tab-progress">
          <section className="song-panel practice-panel">
            {!form ? (
              <div className="timer">
                <span className={`timer-clock readout${runningSince ? ' is-running' : ''}`}>{fmtClock(elapsed)}</span>
                <div className="timer-controls">
                  {runningSince
                    ? <button type="button" className="btn btn-secondary" onClick={pause}>Pause</button>
                    : <button type="button" className="btn btn-primary" onClick={start}>{elapsed > 0 ? 'Resume' : 'Start practice'}</button>}
                  {elapsed >= 1000 && <button type="button" className="btn" onClick={finish}>Finish &amp; log</button>}
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

            <div className="song-confidence">
              <span className="field-label">Confidence</span>
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
              <span className="readout song-confidence-value">{song.confidence}</span>
            </div>
          </section>

          <section className="song-panel">
            <div className="surface-label">
              <IconSection kind="session" /><span>Sessions</span>
              {total > 0 && <span className="readout">{total} min in all</span>}
            </div>
            {sessions.length > 0 ? (
              <ol className="session-log">
                {sessions.map(s => (
                  <li key={s.id} className="session-row">
                    <span className="session-when readout">{fmtDate(s.date)}</span>
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
            ) : (
              <p className="song-empty">Nothing logged yet. Start practice above, and finish to log it.</p>
            )}
          </section>

          <section className="song-panel">
            <div className="surface-label"><IconSection kind="notes" /><span>Notes</span></div>
            <textarea
              className="text-field song-notes"
              rows={3}
              placeholder="What you learned, what to watch for…"
              value={notesDraft}
              onChange={e => setNotesDraft(e.target.value)}
              onBlur={() => { if (notesDraft !== song.notes) void updateSong(song.id, { notes: notesDraft }); }}
            />
          </section>
        </div>
      )}

      {/* Always mounted, so the song keeps playing while another tab is open.
          Only its sheet hides. */}
      <SongChartPanel
        song={song}
        visible={tab === 'play'}
        mode={chartMode}
        onMode={setChartMode}
        dock={dock}
      />

      <div className="song-dock" ref={setDock} />
    </div>
  );
};

/**
 * The things you do to a song rarely: rework its chart, bring one in, flag it,
 * or get rid of it. Deleting takes the practice log with it and cannot be
 * undone, so it asks first, here, out of the way of anything you press often.
 */
const SongMenu: React.FC<{
  revisit: boolean;
  sessionCount: number;
  title: string;
  onEdit: () => void;
  onImport: () => void;
  onRevisit: () => void;
  onDelete: () => void;
}> = ({ revisit, sessionCount, title, onEdit, onImport, onRevisit, onDelete }) => {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) { setConfirming(false); return; }
    const away = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', away);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  const pick = (fn: () => void) => () => { setOpen(false); fn(); };

  return (
    <div className="song-menu" ref={box}>
      <button
        type="button"
        className="song-menu-btn"
        aria-label="More"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" />
        </svg>
      </button>
      {open && (
        <div className="song-menu-list" role="menu">
          {confirming ? (
            <div className="song-menu-confirm">
              <p>Delete “{title}” and its {sessionCount} logged {sessionCount === 1 ? 'session' : 'sessions'}? This cannot be undone.</p>
              <div>
                <button type="button" className="btn song-delete" onClick={pick(onDelete)}>Delete</button>
                <button type="button" className="btn" onClick={() => setConfirming(false)}>Keep it</button>
              </div>
            </div>
          ) : (
            <>
              <button type="button" role="menuitem" onClick={pick(onEdit)}>Edit chart</button>
              <button type="button" role="menuitem" onClick={pick(onImport)}>Import a chord sheet</button>
              <button type="button" role="menuitem" onClick={pick(onRevisit)}>{revisit ? 'Remove revisit flag' : 'Mark to revisit'}</button>
              <button type="button" role="menuitem" className="is-danger" onClick={() => setConfirming(true)}>Delete song</button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default SongPage;
