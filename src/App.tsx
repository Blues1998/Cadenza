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

function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const { theme, toggleTheme } = useTheme();

  // On a phone, a horizontal swipe steps through the current sidebar group
  useLabSwipe(activeTab, setActiveTab);

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
        return <DashboardLanding setActiveTab={setActiveTab} />;
      case 'journey':
        return <JourneyLab setActiveTab={setActiveTab} />;
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
      default:
        return <DashboardLanding setActiveTab={setActiveTab} />;
    }
  };

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} theme={theme} toggleTheme={toggleTheme} />

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
