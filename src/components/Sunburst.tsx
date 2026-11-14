import React, { useEffect, useRef, useState } from 'react';
import { BrandMark } from './Brand';
import { feel } from '../utils/haptics';
import { audio } from '../utils/audio';
import { voicingsFor } from '../utils/chordbook';
import { revealSunburst, setSunburst, SUNBURST_REVEAL_EVENT } from '../utils/sunburst';

/** The moment the gold mark is first tapped. */
export const SunburstReveal: React.FC = () => {
  const [open, setOpen] = useState(false);
  const tryIt = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const show = () => {
      setOpen(true);
      feel('success');
      // E major, rung out: the chord the finish is named after the look of.
      const v = voicingsFor('E')[0];
      if (v) audio.playStrum(v.midis);
    };
    window.addEventListener(SUNBURST_REVEAL_EVENT, show);
    return () => window.removeEventListener(SUNBURST_REVEAL_EVENT, show);
  }, []);

  useEffect(() => {
    if (!open) return;
    tryIt.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      revealSunburst();
      setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open) return null;

  const close = (wear: boolean) => {
    revealSunburst();
    if (wear) setSunburst(true);
    setOpen(false);
  };

  return (
    <div className="sunburst-backdrop" onClick={() => close(false)}>
      <div className="sunburst-card" role="dialog" aria-modal="true" aria-labelledby="sunburst-title" onClick={e => e.stopPropagation()}>
        <div className="sunburst-art" aria-hidden="true">
          <span className="sunburst-rays" />
          <BrandMark className="is-gold" />
        </div>
        <p className="sunburst-eyebrow">7 days in a row</p>
        <h2 id="sunburst-title" className="sunburst-title">Sunburst unlocked</h2>
        <p className="sunburst-body">
          A week of practice without missing a day. That is how songs get learned.
          Your reward is a new finish for the app, warm like the lacquer on an old guitar.
        </p>
        <div className="sunburst-actions">
          <button ref={tryIt} type="button" className="btn btn-primary" onClick={() => close(true)}>Try it on</button>
          <button type="button" className="btn" onClick={() => close(false)}>Maybe later</button>
        </div>
        <p className="sunburst-note">Switch it any time in Me.</p>
      </div>
    </div>
  );
};
