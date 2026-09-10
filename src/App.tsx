import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { GROUPS, type ActiveTab } from './components/navGroups';
import { useTheme } from './hooks/useTheme';
import { useLabSwipe } from './hooks/useLabSwipe';
import { go, useRoute } from './hooks/useRoute';
import { parseHash } from './utils/route';
import { LAB_CHUNKS } from './labs/chunks';

// One download per destination.
//
// Imported together they came to a 1.6 MB bundle, most of it the score
// renderer the Tab Player needs — paid for in full by someone opening the
// tuner. Split, the shell and the screen you asked for are all that is
// fetched, and the rail warms the rest as you point at it.
const DashboardLanding = lazy(LAB_CHUNKS.dashboard);
const JourneyLab = lazy(LAB_CHUNKS.journey);
const TheoryLab = lazy(LAB_CHUNKS.theory);
const PhysicsLab = lazy(LAB_CHUNKS.physics);
const SongsLab = lazy(LAB_CHUNKS.library);
const ChordBookLab = lazy(LAB_CHUNKS.chordbook);
const EarTrainingLab = lazy(LAB_CHUNKS['ear-training']);
const RhythmLab = lazy(LAB_CHUNKS.rhythm);
const TunerLab = lazy(LAB_CHUNKS.tuner);
const PlayLab = lazy(LAB_CHUNKS.play);
const TabPlayerLab = lazy(LAB_CHUNKS.tabs);
const SongHeroLab = lazy(LAB_CHUNKS.songs);

const LABELS = new Map<ActiveTab, string>(
  GROUPS.flatMap(group => group.items.map(item => [item.id, item.label] as [ActiveTab, string]))
);

function App() {
  // The address bar is the state. Everything that used to be held here — which
  // lab, which song — is read back from it, so a reload lands where you were,
  // Back goes back, and a screen can be linked to.
  const { tab: activeTab, songId } = useRoute();
  const { theme, toggleTheme } = useTheme();

  // Opening the form on a given day is an intention, not a place: it is spent
  // the moment the form appears, and an address you could return to would keep
  // reopening a blank form over whatever you had since typed.
  const [draftDay, setDraftDay] = useState<number | null>(null);

  // Whatever was typed, tidied to the address that was actually shown — a bare
  // URL, a stale slug, the wrong case. Replaced rather than pushed: the
  // correction is not a step anyone should be able to walk back into.
  //
  // Read from the bar at the moment it runs rather than from the render that
  // scheduled it. Effects run child-first, so a screen that corrects its own
  // address on the way up — SongsLab does, for a link to a song that is gone —
  // would otherwise be overruled here by a parent still holding the address it
  // just replaced.
  useEffect(() => {
    go(parseHash(window.location.hash), true);
  }, [activeTab, songId]);

  const openSong = (id: string) => go({ tab: 'library', songId: id });

  // Stable, because SongsLab watches both of these from effects.
  const showSong = useCallback(
    (id: string | null, replace = false) => go({ tab: 'library', songId: id }, replace),
    []
  );

  const addSongForDay = (day: number | null) => {
    setDraftDay(day ?? 0);   // 0 = open the form with no day filled in
    go({ tab: 'library', songId: null });
  };

  // Pressing a destination in the rail goes to that destination. Songs used to
  // reopen the last song you had read, which made a nav item land somewhere
  // other than the page it names; carrying the song in the address makes the
  // list and the song two different places, so the plain destination is the
  // list and Back is how you get out of a song.
  const navigate = (tab: ActiveTab) => go({ tab, songId: null });

  const clearDraft = useCallback(() => setDraftDay(null), []);

  // On a phone, a horizontal swipe steps through the current sidebar group
  useLabSwipe(activeTab, navigate);

  // Labs are several screens tall and the window keeps its scroll offset when
  // the content under it is swapped, so switching from a scrolled lab used to
  // drop you into the middle of the next one with its header off-screen.
  // Instant rather than smooth: this is a page change, not a jump within one.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [activeTab]);

  const renderActiveContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardLanding setActiveTab={navigate} onOpenSong={openSong} onAddSongForDay={addSongForDay} />;
      case 'journey':
        return <JourneyLab setActiveTab={navigate} />;
      case 'ear-training':
        return <EarTrainingLab />;
      case 'theory':
        return <TheoryLab />;
      case 'play':
        return <PlayLab />;
      case 'physics':
        return <PhysicsLab />;
      case 'rhythm':
        return <RhythmLab />;
      case 'tuner':
        return <TunerLab />;
      case 'tabs':
        return <TabPlayerLab />;
      case 'songs':
        return <SongHeroLab />;
      case 'chordbook':
        return <ChordBookLab />;
      case 'library':
        return (
          <SongsLab
            focusSongId={songId}
            onOpenSong={showSong}
            draftDay={draftDay}
            onDraftOpened={clearDraft}
          />
        );
      default:
        return <DashboardLanding setActiveTab={navigate} onOpenSong={openSong} onAddSongForDay={addSongForDay} />;
    }
  };

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <Sidebar activeTab={activeTab} setActiveTab={navigate} theme={theme} toggleTheme={toggleTheme} />

      {/* Main Panel Content Area */}
      {/* key on the tab so each lab mounts fresh and plays the entrance
          transition, instead of the new content appearing mid-swap */}
      <main className="main-content">
        <div key={activeTab} className="lab-enter">
          {/* Shown only the first time a lab is opened, and usually not even
              then: the rail has normally started the download already. */}
          <Suspense fallback={
            <p className="lab-loading readout" role="status">
              Opening {LABELS.get(activeTab) ?? 'Cadenza'}…
            </p>
          }>
            {renderActiveContent()}
          </Suspense>
        </div>
      </main>
    </div>
  );
}

export default App;
