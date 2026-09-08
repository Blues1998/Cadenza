import { useEffect } from 'react';
import { GROUPS } from '../components/navGroups';
import type { ActiveTab } from '../components/navGroups';

const MOBILE_MAX = 900;      // matches the shell's breakpoint
const MIN_DISTANCE = 64;     // px, below this it is a tap or a stray drag
const MAX_DURATION = 700;    // ms, a slow drag is a scroll that wandered
const DOMINANCE = 1.8;       // how much more horizontal than vertical it must be

// Where a lab sits in the rail: which group, and where within it.
function neighbour(current: ActiveTab, direction: 1 | -1): ActiveTab | null {
  const group = GROUPS.find(g => g.items.some(i => i.id === current));
  if (!group) return null;
  const index = group.items.findIndex(i => i.id === current);
  const next = group.items[index + direction];
  return next ? next.id : null;
}

// A horizontal swipe moves to the next lab, but only within the group the
// current one belongs to. Flinging blindly through all ten would leave you
// somewhere unrelated with no sense of how you got there; bounded to Learn,
// Practice or Play, a swipe is a step along a shelf you can already see.
export function useLabSwipe(activeTab: ActiveTab, setActiveTab: (tab: ActiveTab) => void) {
  useEffect(() => {
    let startX = 0;
    let startY = 0;
    let startedAt = 0;
    let armed = false;

    const onStart = (e: TouchEvent) => {
      // Checked per gesture rather than once on mount, so rotating a phone or
      // resizing a window does not leave the gesture armed or disarmed wrongly.
      if (window.innerWidth > MOBILE_MAX) return;
      if (e.touches.length !== 1) { armed = false; return; }
      const touch = e.touches[0];

      // A swipe that begins on something scrollable sideways — the neck of the
      // guitar, a toolbar, the tab score — belongs to that thing, not to us.
      let node = e.target as HTMLElement | null;
      while (node && node !== document.body) {
        const overflowX = getComputedStyle(node).overflowX;
        if ((overflowX === 'auto' || overflowX === 'scroll') && node.scrollWidth > node.clientWidth) return;
        node = node.parentElement;
      }

      startX = touch.clientX;
      startY = touch.clientY;
      startedAt = Date.now();
      armed = true;
    };

    const onEnd = (e: TouchEvent) => {
      if (!armed) return;
      armed = false;
      const touch = e.changedTouches[0];
      if (!touch) return;

      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      if (Date.now() - startedAt > MAX_DURATION) return;
      if (Math.abs(dx) < MIN_DISTANCE) return;
      if (Math.abs(dx) < Math.abs(dy) * DOMINANCE) return;

      // Swiping left moves forward, the way a page turns
      const target = neighbour(activeTab, dx < 0 ? 1 : -1);
      if (target) setActiveTab(target);
    };

    // Passive: the gesture is only ever measured, never used to block the
    // browser's own scrolling.
    document.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('touchend', onEnd, { passive: true });
    return () => {
      document.removeEventListener('touchstart', onStart);
      document.removeEventListener('touchend', onEnd);
    };
  }, [activeTab, setActiveTab]);
}

export default useLabSwipe;
