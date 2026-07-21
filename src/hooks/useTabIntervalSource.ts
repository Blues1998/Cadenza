import { useState, useRef, useCallback, useEffect } from 'react';
import { AlphaTabApi } from '@coderline/alphatab';
import { GUITAR_SOUNDFONT_URL, DEFAULT_GUITAR_TONE, setScoreInstrument } from '../utils/guitarTones';
import { extractIntervalCandidates } from '../utils/tabIntervalSource';
import type { TabIntervalCandidate } from '../utils/tabIntervalSource';
import { listLibraryTabs, loadTabBlob } from '../utils/tabLibrary';
import type { TabLibraryEntry } from '../utils/tabLibrary';

export interface TabIntervalSource {
  libraryEntries: TabLibraryEntry[];
  selectedTab: TabLibraryEntry | null;
  candidates: TabIntervalCandidate[];
  isLoading: boolean;
  error: string | null;
  selectTab: (entry: TabLibraryEntry) => void;
  playCandidate: (candidate: TabIntervalCandidate) => void;
  refreshLibrary: () => void;
}

// Drives a hidden alphaTab instance purely to parse a tab's real note data
// and play it back with an authentic guitar tone — never rendered on screen,
// since Ear Training is about listening and identifying, not reading
// notation. Reuses the same tab library (IndexedDB) the Tab Player lab
// saves into, so any previously imported piece is available here too.
//
// The alphaTab instance (and its soundfont download) is created lazily on
// first tab selection rather than on mount, so visiting this lab without
// ever using "practice from my tabs" costs nothing extra.
export function useTabIntervalSource(): TabIntervalSource {
  const [libraryEntries, setLibraryEntries] = useState<TabLibraryEntry[]>([]);
  const [selectedTab, setSelectedTab] = useState<TabLibraryEntry | null>(null);
  const [candidates, setCandidates] = useState<TabIntervalCandidate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiRef = useRef<AlphaTabApi | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const midiReadyRef = useRef(false);

  const refreshLibrary = useCallback(() => {
    listLibraryTabs().then(setLibraryEntries).catch(() => {});
  }, []);
  useEffect(() => {
    refreshLibrary();
  }, [refreshLibrary]);

  // Guaranteed cleanup on unmount; the instance itself is only actually
  // created inside ensureApi() below, the first time it's needed.
  useEffect(() => {
    return () => {
      apiRef.current?.destroy();
      apiRef.current = null;
      containerRef.current?.remove();
      containerRef.current = null;
    };
  }, []);

  const ensureApi = useCallback((): AlphaTabApi => {
    if (apiRef.current) return apiRef.current;

    // Off-screen but not display:none/zero-size — alphaTab warns and waits
    // ("container was invisible while autosizing") for a truly invisible
    // element, so this stays a real, positioned, non-zero box, just parked
    // far outside the viewport where nobody will ever see it.
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.top = '0';
    container.style.left = '-99999px';
    container.style.width = '800px';
    container.style.height = '200px';
    document.body.appendChild(container);
    containerRef.current = container;

    const api = new AlphaTabApi(container, {
      core: { fontDirectory: '/font/' },
      player: {
        enablePlayer: true,
        playerMode: 'EnabledAutomatic',
        soundFont: '/soundfont/sonivox.sf2',
        enableCursor: false
      }
    });
    apiRef.current = api;

    let guitarFontAppended = false;
    api.soundFontLoaded.on(() => {
      if (guitarFontAppended) return;
      guitarFontAppended = true;
      api.loadSoundFont(GUITAR_SOUNDFONT_URL, true);
    });

    api.scoreLoaded.on((score) => {
      setScoreInstrument(score, DEFAULT_GUITAR_TONE.bank, DEFAULT_GUITAR_TONE.program);
      midiReadyRef.current = false;
      api.loadMidiForScore();
    });
    api.midiLoaded.on(() => {
      midiReadyRef.current = true;
      // Candidates need tickCache (built from the generated MIDI, which
      // accounts for repeats) for their tick ranges to actually correspond
      // to the analyzed notes during real playback — see the comment in
      // extractIntervalCandidates for why the structural ticks alone aren't
      // enough.
      if (api.score) setCandidates(extractIntervalCandidates(api.score, api.tickCache));
      setIsLoading(false);
    });
    api.error.on((e) => {
      console.error('Ear Training tab source error', e);
      setError('Could not load this tab for practice.');
      setIsLoading(false);
    });

    return api;
  }, []);

  const selectTab = useCallback((entry: TabLibraryEntry) => {
    setError(null);
    setIsLoading(true);
    setCandidates([]);
    setSelectedTab(entry);
    midiReadyRef.current = false;
    const api = ensureApi();
    loadTabBlob(entry.id)
      .then((data) => {
        if (!data) {
          setError('Could not load this tab for practice.');
          setIsLoading(false);
          return;
        }
        api.load(new Uint8Array(data));
      })
      .catch(() => {
        setError('Could not load this tab for practice.');
        setIsLoading(false);
      });
  }, [ensureApi]);

  const playCandidate = useCallback((candidate: TabIntervalCandidate) => {
    const api = apiRef.current;
    if (!api || !midiReadyRef.current) return;
    api.playbackRange = { startTick: candidate.startTick, endTick: candidate.endTick };
    api.tickPosition = candidate.startTick;
    api.play();
  }, []);

  return { libraryEntries, selectedTab, candidates, isLoading, error, selectTab, playCandidate, refreshLibrary };
}
