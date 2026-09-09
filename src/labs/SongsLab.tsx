import React, { useEffect, useMemo, useRef, useState } from 'react';
import { DayGrid } from '../components/DayGrid';
import { Segmented } from '../components/Segmented';
import { SongPage } from './SongPage';
import { useLibrary } from '../hooks/useLibrary';
import {
  challengeProgress,
  createSong,
  exportLibrary,
  getSong,
  getSongs,
  importLibrary,
  isoDate,
  practiceStats,
  songChords,
  STATUS_LABEL,
  STATUS_ORDER,
  storageLabel,
  totalMinutes
} from '../utils/library';
import type { Song, SongStatus } from '../utils/library';
import { capoLabel, parseCapo } from '../utils/songText';

interface SongsLabProps {
  focusSongId: string | null;
  onOpenSong: (id: string | null) => void;
  /** Set when Home sent you here to write today's song down. 0 = no day. */
  draftDay: number | null;
  onDraftOpened: () => void;
}

type Filter = 'all' | SongStatus | 'revisit';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  ...STATUS_ORDER.map(s => ({ value: s as Filter, label: STATUS_LABEL[s] })),
  { value: 'revisit', label: 'Revisit' }
];

const blankDraft = (day: number | null) => ({
  day: day ? String(day) : '',
  title: '',
  artist: '',
  key: '',
  capo: '',
  chordsRaw: '',
  strumming: '',
  practiceMinutes: '',
  confidence: '0'
});

export const SongsLab: React.FC<SongsLabProps> = ({ focusSongId, onOpenSong, draftDay, onDraftOpened }) => {
  const ready = useLibrary();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [draft, setDraft] = useState<ReturnType<typeof blankDraft> | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const progress = challengeProgress();
  const stats = practiceStats();
  const songs = getSongs();

  // Arriving from Home's empty state: open the form already on today's day,
  // then hand the intent back so a later re-render does not reopen it over
  // something you have since typed.
  useEffect(() => {
    if (draftDay === null) return;
    setDraft(blankDraft(draftDay > 0 ? draftDay : null));
    onDraftOpened();
  }, [draftDay, onDraftOpened]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return songs
      .filter(song => {
        if (filter === 'revisit' ? !song.revisit : filter !== 'all' && song.status !== filter) return false;
        if (!q) return true;
        return [song.title, song.artist, song.key, song.chordsRaw]
          .some(field => field.toLowerCase().includes(q));
      })
      // Challenge days first and in order; anything off the calendar follows,
      // newest first, so an added song does not vanish into the middle.
      .sort((a, b) => {
        if (a.day && b.day) return a.day - b.day;
        if (a.day) return -1;
        if (b.day) return 1;
        return b.createdAt - a.createdAt;
      });
  }, [songs, query, filter]);

  const focused = focusSongId ? getSong(focusSongId) : undefined;

  const submitDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft || !draft.title.trim()) return;
    const day = draft.day ? Number(draft.day) : null;
    const song = await createSong({
      title: draft.title,
      artist: draft.artist,
      day: day && day >= 1 && day <= progress.dayCount ? day : null,
      key: draft.key,
      capo: parseCapo(draft.capo),
      chordsRaw: draft.chordsRaw,
      strumming: draft.strumming,
      practiceMinutes: Number(draft.practiceMinutes) || 0,
      confidence: Number(draft.confidence) || 0
    });
    setDraft(null);
    onOpenSong(song.id);
  };

  const doExport = () => {
    const blob = new Blob([JSON.stringify(exportLibrary(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cadenza-library-${isoDate()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setNotice(`Exported ${songs.length} songs and ${stats.sessionCount} sessions.`);
  };

  const doImport = async (file: File) => {
    const text = await file.text();
    const result = await importLibrary(text);
    setNotice(result.ok
      ? `Restored ${result.songs} songs and ${result.sessions} sessions.`
      : result.message);
    onOpenSong(null);
  };

  if (focused) return <SongPage song={focused} onBack={() => onOpenSong(null)} />;

  if (!ready) {
    return <div className="songs-loading readout">Opening your library…</div>;
  }

  const pickDay = (day: number, song: Song | null) => {
    if (song) onOpenSong(song.id);
    else setDraft(blankDraft(day));
  };

  return (
    <div className="songs">
      <header className="songs-head">
        <div>
          <h2 className="lab-title">{progress.challenge?.name ?? 'Songs'}</h2>
          <p className="songs-count readout">
            <strong>{String(progress.entered).padStart(2, '0')}</strong> / {progress.dayCount || songs.length}
            <span className="songs-count-sub">
              {progress.complete} complete · {stats.totalMinutes} min logged
            </span>
          </p>
        </div>
        <div className="songs-actions">
          <button type="button" className="btn btn-primary" onClick={() => setDraft(blankDraft(progress.currentDay))}>
            Add song
          </button>
          <button type="button" className="btn" onClick={doExport}>Export</button>
          <button type="button" className="btn" onClick={() => fileInput.current?.click()}>Import</button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={e => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) void doImport(file);
            }}
          />
        </div>
      </header>

      {progress.dayCount > 0 && (
        <section className="songs-calendar">
          <DayGrid byDay={progress.byDay} currentDay={progress.currentDay} onPick={pickDay} size="md" />
        </section>
      )}

      {notice && (
        <p className="songs-notice" role="status">
          {notice}
          <span className="songs-notice-where">Stored in {storageLabel()} on this device</span>
          <button type="button" className="songs-notice-close" onClick={() => setNotice(null)} aria-label="Dismiss">×</button>
        </p>
      )}

      {draft && (
        <form className="song-draft" onSubmit={e => void submitDraft(e)}>
          <div className="surface-label"><span>New song</span></div>
          <div className="draft-grid">
            <label className="song-field draft-day">
              <span className="field-label">Day</span>
              <input className="text-field readout" inputMode="numeric" value={draft.day}
                onChange={e => setDraft(d => d && { ...d, day: e.target.value.replace(/\D/g, '') })} />
            </label>
            <label className="song-field draft-title">
              <span className="field-label">Title</span>
              {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
              <input className="text-field" autoFocus value={draft.title}
                onChange={e => setDraft(d => d && { ...d, title: e.target.value })} />
            </label>
            <label className="song-field">
              <span className="field-label">Artist</span>
              <input className="text-field" value={draft.artist}
                onChange={e => setDraft(d => d && { ...d, artist: e.target.value })} />
            </label>
            <label className="song-field">
              <span className="field-label">Key</span>
              <input className="text-field" placeholder="D minor" value={draft.key}
                onChange={e => setDraft(d => d && { ...d, key: e.target.value })} />
            </label>
            <label className="song-field draft-capo">
              <span className="field-label">Capo</span>
              <input className="text-field readout" inputMode="numeric" placeholder="5" value={draft.capo}
                onChange={e => setDraft(d => d && { ...d, capo: e.target.value })} />
            </label>
            <label className="song-field draft-chords">
              <span className="field-label">Chords</span>
              <input className="text-field" placeholder="A min → E min → F maj | C maj → G maj" value={draft.chordsRaw}
                onChange={e => setDraft(d => d && { ...d, chordsRaw: e.target.value })} />
            </label>
            <label className="song-field">
              <span className="field-label">Strumming</span>
              <input className="text-field readout" placeholder="D D U U D U" value={draft.strumming}
                onChange={e => setDraft(d => d && { ...d, strumming: e.target.value })} />
            </label>
          </div>
          <div className="draft-actions">
            <button type="submit" className="btn btn-primary" disabled={!draft.title.trim()}>Add song</button>
            <button type="button" className="btn" onClick={() => setDraft(null)}>Cancel</button>
          </div>
        </form>
      )}

      <div className="songs-controls">
        <label className="songs-search">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" /><line x1="20" y1="20" x2="16.7" y2="16.7" />
          </svg>
          <input
            className="text-field"
            type="search"
            placeholder="Search title, artist, key or chord"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </label>
        <Segmented<Filter>
          value={filter}
          onChange={setFilter}
          options={FILTERS}
          ariaLabel="Filter songs"
          size="sm"
        />
      </div>

      {visible.length === 0 ? (
        <p className="songs-empty">
          {songs.length === 0
            ? 'No songs yet. Add the first one and the month starts.'
            : 'Nothing matches that.'}
        </p>
      ) : (
        <ul className="songlist">
          {visible.map(song => {
            const chords = songChords(song);
            return (
              <li key={song.id}>
                <button type="button" className="songrow" onClick={() => onOpenSong(song.id)}>
                  <span className="songrow-day readout">
                    {song.day ? String(song.day).padStart(2, '0') : '—'}
                  </span>
                  <span className="songrow-name">
                    <span className="songrow-titleline">
                      <span className="songrow-title">{song.title}</span>
                      {/* Marked here, toggled on the song's own page — a second
                          control inside a row that is itself a button is a
                          click you have to aim at. */}
                      {song.revisit && <span className="revisit-flag readout">revisit</span>}
                    </span>
                    <span className="songrow-artist">{song.artist}</span>
                  </span>
                  <span className="songrow-key readout">
                    {song.key}
                    {song.capo !== null && song.capo > 0 && <span className="songrow-capo"> · {capoLabel(song.capo)}</span>}
                  </span>
                  <span className="songrow-chords readout">{chords.join(' · ')}</span>
                  <span className="songrow-conf" title={`Confidence ${song.confidence} of 10`}>
                    <span className="conf-bar"><span style={{ width: `${song.confidence * 10}%` }} /></span>
                    <span className="readout">{song.confidence}</span>
                  </span>
                  <span className="songrow-mins readout">{totalMinutes(song)} min</span>
                  <span className={`status-chip is-${song.status}`}>{STATUS_LABEL[song.status]}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default SongsLab;
