import React from 'react';
import { GROUPS, type ActiveTab } from './navGroups';

const ICONS = new Map<ActiveTab, React.ReactNode>(
  GROUPS.flatMap(group => group.items.map(item => [item.id, item.icon] as [ActiveTab, React.ReactNode]))
);

/**
 * A destination's own mark, at the top of the destination.
 *
 * The rail has spent real work giving every lab a picture that does the thing
 * it is a picture of — the book turns a page, the metronome counts four, the
 * bullseye ripples — and the page each of those marks leads to used to open
 * with nothing but a line of text. This is the same icon from the same list,
 * wearing the same classes, so there is one drawing per destination and one
 * animation for it.
 *
 * The flash class is put on and left on. A CSS animation runs when it is
 * applied and never again, and a lab mounts fresh every time you arrive at it,
 * so the gesture plays once as the screen appears and then the mark sits
 * still — which is the difference between an arrival and a fidget.
 */
export const LabIcon: React.FC<{ tab: ActiveTab }> = ({ tab }) => {
  const icon = ICONS.get(tab);
  if (!icon) return null;
  return (
    <span className="labicon navmark is-flashing" data-nav={tab} aria-hidden="true">
      <span className="channel-icon">{icon}</span>
    </span>
  );
};

export default LabIcon;
