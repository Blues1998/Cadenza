import { useEffect, useState } from 'react';
import { Sidebar } from './components/Sidebar';
import type { ActiveTab } from './components/Sidebar';
import { useTheme } from './hooks/useTheme';
import { useLabSwipe } from './hooks/useLabSwipe';
import { DashboardLanding } from './labs/DashboardLanding';
import { JourneyLab } from './labs/JourneyLab';
import { EarTrainingLab } from './labs/EarTrainingLab';
import { TheoryLab } from './labs/TheoryLab';
import { PlayLab } from './labs/PlayLab';
import { PhysicsLab } from './labs/PhysicsLab';
import { RhythmLab } from './labs/RhythmLab';
import { TunerLab } from './labs/TunerLab';
import { TabPlayerLab } from './labs/TabPlayerLab';
import { SongHeroLab } from './labs/SongHeroLab';
import { SongsLab } from './labs/SongsLab';

function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const { theme, toggleTheme } = useTheme();

  // Which song the library is showing, and whether it should open on a blank
  // one. Held here rather than inside the library so that Home can send you
  // straight to a song or straight to adding today's — the two things Home
  // exists to do — without the two screens having to know about each other.
  const [songFocus, setSongFocus] = useState<string | null>(null);
  const [draftDay, setDraftDay] = useState<number | null>(null);

  const openSong = (id: string) => {
    setSongFocus(id);
    setDraftDay(null);
    setActiveTab('library');
  };

  const addSongForDay = (day: number | null) => {
    setSongFocus(null);
    setDraftDay(day ?? 0);   // 0 = open the form with no day filled in
    setActiveTab('library');
  };

  // Pressing a destination in the rail goes to that destination. Songs kept the
  // last song you had open, so the rail's Songs would reopen it — a nav item
  // that lands somewhere other than the page it names, with no way back to the
  // list except the arrow inside it. openSong above sets the tab itself and so
  // is unaffected.
  const navigate = (tab: ActiveTab) => {
    if (tab === 'library') setSongFocus(null);
    setActiveTab(tab);
  };

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
      case 'library':
        return (
          <SongsLab
            focusSongId={songFocus}
            onOpenSong={setSongFocus}
            draftDay={draftDay}
            onDraftOpened={() => setDraftDay(null)}
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
          {renderActiveContent()}
        </div>
      </main>
    </div>
  );
}

export default App;
