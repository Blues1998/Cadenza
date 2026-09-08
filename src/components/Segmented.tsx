import React from 'react';

export interface SegmentedOption<T> {
  value: T;
  label: React.ReactNode;
  title?: string;      // tooltip, for options whose label is abbreviated
  disabled?: boolean;
}

interface SegmentedProps<T> {
  value: T;
  onChange: (value: T) => void;
  options: SegmentedOption<T>[];
  label?: string;                    // rendered above as the group's caption
  ariaLabel?: string;                // accessible name when the caption lives elsewhere
  tone?: 'primary' | 'secondary';
  size?: 'sm' | 'md';
  full?: boolean;                    // stretch options to fill the row
}

// One choice out of a few, as a single control rather than a row of buttons
// that each look like an independent action. Labs used to hand-roll these as
// `btn`/`btn-primary` pairs, which read as two things you could press instead
// of two states of one setting — and every lab sized them slightly differently.
export function Segmented<T extends string | number | boolean>({
  value,
  onChange,
  options,
  label,
  ariaLabel,
  tone = 'primary',
  size = 'md',
  full = false
}: SegmentedProps<T>) {
  const group = (
    <div
      className={`segmented${tone === 'secondary' ? ' is-secondary' : ''}${size === 'sm' ? ' is-sm' : ''}${full ? ' is-full' : ''}`}
      role="group"
      aria-label={ariaLabel ?? label}
    >
      {options.map(opt => (
        <button
          key={String(opt.value)}
          type="button"
          onClick={() => onChange(opt.value)}
          aria-pressed={value === opt.value}
          disabled={opt.disabled}
          title={opt.title}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );

  if (!label) return group;
  return (
    <div>
      <span className="field-label">{label}</span>
      {group}
    </div>
  );
}

export default Segmented;
