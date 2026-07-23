import { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import type { ActiveTab } from './components/Sidebar';
import { useTheme } from './hooks/useTheme';
import { DashboardLanding } from './labs/DashboardLanding';
import { EarTrainingLab } from './labs/EarTrainingLab';
import { TheoryLab } from './labs/TheoryLab';
import { PlayLab } from './labs/PlayLab';
import { PhysicsLab } from './labs/PhysicsLab';
import { RhythmLab } from './labs/RhythmLab';
import { TunerLab } from './labs/TunerLab';
import { TabPlayerLab } from './labs/TabPlayerLab';

function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const { theme, toggleTheme } = useTheme();

  const renderActiveContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardLanding setActiveTab={setActiveTab} />;
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
      default:
        return <DashboardLanding setActiveTab={setActiveTab} />;
    }
  };

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} theme={theme} toggleTheme={toggleTheme} />

      {/* Main Panel Content Area */}
      <main className="main-content">
        {renderActiveContent()}
      </main>
    </div>
  );
}

export default App;
