import React, { useRef } from 'react';
import { GLOSSARY } from '../utils/glossary';
import type { GlossaryEntry } from '../utils/glossary';

interface TermProps {
  k: string; // key into `source`
  source?: Record<string, GlossaryEntry>; // defaults to the shared theory GLOSSARY
  children: React.ReactNode;
}

const EDGE_MARGIN = 10;

// Finds the box that would actually clip the tooltip: the nearest ancestor
// with non-visible overflow (e.g. .main-content's scroll pane, which clips
// horizontally too — overflow-y: auto forces overflow-x to behave as auto
// rather than visible), falling back to the viewport if there isn't one.
const getClipRect = (el: HTMLElement): { left: number; right: number; top: number } => {
  let node = el.parentElement;
  while (node && node !== document.body && node !== document.documentElement) {
    const cs = getComputedStyle(node);
    if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') {
      const r = node.getBoundingClientRect();
      return { left: Math.max(r.left, 0), right: Math.min(r.right, window.innerWidth), top: Math.max(r.top, 0) };
    }
    node = node.parentElement;
  }
  return { left: 0, right: window.innerWidth, top: 0 };
};

// Wraps a piece of jargon with a dotted underline and a plain-English tooltip.
// Hover (desktop) or tap/focus (touch, keyboard) reveals the explanation.
export const Term: React.FC<TermProps> = ({ k, source = GLOSSARY, children }) => {
  const entry = source[k];
  const tipRef = useRef<HTMLSpanElement | null>(null);

  // Centering the tooltip on the trigger is right most of the time, but a
  // term near the edge of whatever actually clips it (viewport or a
  // scrolling ancestor) would otherwise push it half off-screen — nudge it
  // back with a measured shift/flip instead.
  const reposition = () => {
    const tip = tipRef.current;
    if (!tip) return;
    tip.style.setProperty('--tip-shift', '0px');
    tip.classList.remove('term-tip--below');

    const rect = tip.getBoundingClientRect();
    const clip = getClipRect(tip);
    if (rect.top < clip.top + EDGE_MARGIN) {
      tip.classList.add('term-tip--below');
    }
    let shift = 0;
    if (rect.left < clip.left + EDGE_MARGIN) {
      shift = (clip.left + EDGE_MARGIN) - rect.left;
    } else if (rect.right > clip.right - EDGE_MARGIN) {
      shift = (clip.right - EDGE_MARGIN) - rect.right;
    }
    tip.style.setProperty('--tip-shift', `${shift}px`);
  };

  if (!entry) return <>{children}</>;

  return (
    <span className="term" tabIndex={0} onMouseEnter={reposition} onFocus={reposition}>
      {children}
      <span ref={tipRef} className="term-tip" role="tooltip">
        <strong>{entry.title}</strong>
        {entry.definition}
      </span>
    </span>
  );
};
export default Term;
