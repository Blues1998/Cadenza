import React from 'react';
import { assetUrl } from '../utils/assetUrl';

export const BRAND = 'Sharps&Flats';

/** The ♯♭ mark, cropped from the logo (design/brand). Decorative: the name is always beside it. */
export const BrandMark: React.FC<{ className?: string }> = ({ className }) => (
  <img className={`brandmark${className ? ` ${className}` : ''}`} src={assetUrl('brand/mark.png')} alt="" draggable={false} />
);

/** "Sharps&Flats" as the logo sets it: the ampersand in the brand orange. */
export const Wordmark: React.FC<{ className?: string }> = ({ className }) => (
  <span className={`wordmark${className ? ` ${className}` : ''}`} aria-label={BRAND}>
    <span aria-hidden="true">Sharps</span>
    <span className="wordmark-amp" aria-hidden="true">&amp;</span>
    <span aria-hidden="true">Flats</span>
  </span>
);
