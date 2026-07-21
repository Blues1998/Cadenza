import React from 'react';
import { GLOSSARY } from '../utils/glossary';
import type { GlossaryEntry } from '../utils/glossary';

interface TermProps {
  k: string; // key into `source`
  source?: Record<string, GlossaryEntry>; // defaults to the shared theory GLOSSARY
  children: React.ReactNode;
}

// Wraps a piece of jargon with a dotted underline and a plain-English tooltip.
// Hover (desktop) or tap/focus (touch, keyboard) reveals the explanation.
export const Term: React.FC<TermProps> = ({ k, source = GLOSSARY, children }) => {
  const entry = source[k];
  if (!entry) return <>{children}</>;

  return (
    <span className="term" tabIndex={0}>
      {children}
      <span className="term-tip" role="tooltip">
        <strong>{entry.title}</strong>
        {entry.definition}
      </span>
    </span>
  );
};
export default Term;
