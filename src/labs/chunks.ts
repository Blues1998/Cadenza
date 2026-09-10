// Which file each destination lives in — and nothing else, so this can be
// imported by the rail without dragging a screen's worth of React in with it.
//
// `satisfies` rather than a type annotation: the annotation would widen every
// entry to Promise<unknown> and lazy() would lose the prop types of the
// component it is loading. This way the check is made and the exact types
// survive it.

import type { ActiveTab } from '../components/navGroups';

export const LAB_CHUNKS = {
  dashboard: () => import('./DashboardLanding'),
  journey: () => import('./JourneyLab'),
  theory: () => import('./TheoryLab'),
  physics: () => import('./PhysicsLab'),
  library: () => import('./SongsLab'),
  chordbook: () => import('./ChordBookLab'),
  'ear-training': () => import('./EarTrainingLab'),
  rhythm: () => import('./RhythmLab'),
  tuner: () => import('./TunerLab'),
  play: () => import('./PlayLab'),
  tabs: () => import('./TabPlayerLab'),
  songs: () => import('./SongHeroLab')
} satisfies Record<ActiveTab, () => Promise<unknown>>;

/**
 * Start fetching a lab before it is asked for.
 *
 * A pointer resting on a rail row is a decision most of the way made, so the
 * download starts there rather than on the press — which is usually enough for
 * the screen to be ready by the time the button goes down. Failures are
 * swallowed: this is a guess, and the press that follows will ask properly and
 * surface any real problem itself.
 */
export function preloadLab(tab: ActiveTab): void {
  void LAB_CHUNKS[tab]().catch(() => { /* the press will ask again */ });
}
