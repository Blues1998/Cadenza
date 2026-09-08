import React from 'react';
import type { ActiveTab } from '../components/Sidebar';
import { Journey } from '../components/Journey';

// The curriculum used to sit under the dashboard hero, which made the landing
// page a wall of levels before you had chosen to look at any. It is a place
// you go to, so it gets a page.
export const JourneyLab: React.FC<{ setActiveTab: (tab: ActiveTab) => void }> = ({ setActiveTab }) => (
  <div>
    <div className="lab-header">
      <h2 className="lab-title">Journey</h2>
    </div>
    <Journey setActiveTab={setActiveTab} />
  </div>
);
export default JourneyLab;
