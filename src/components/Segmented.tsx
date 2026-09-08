import React, { useLayoutEffect, useRef, useState } from 'react';

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
//
// The selection is one element that slides between options rather than a
// background switching off here and on there. This is the most-pressed control
// in the app, so the travel is what carries the sense that the segments are
// two states of one setting and not two separate buttons.
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
  const groupRef = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState<{ left: number; width: number } | null>(null);
  // The first placement is a jump, not a slide: without this the thumb would
  // fly in from the left edge every time a lab mounts.
  const placed = useRef(false);

  const selectedIndex = options.findIndex(o => o.value === value);

  useLayoutEffect(() => {
    const group = groupRef.current;
    if (!group) return;

    const measure = () => {
      const target = group.querySelector<HTMLElement>('[data-selected="true"]');
      if (!target) {
        setThumb(null);
        return;
      }
      setThumb({ left: target.offsetLeft, width: target.offsetWidth });
    };

    measure();
    // Labels reflow when a web font lands or the row is resized, and a thumb
    // measured against the old widths would sit off its segment.
    const observer = new ResizeObserver(measure);
    observer.observe(group);
    for (const child of group.children) observer.observe(child);
    return () => observer.disconnect();
  }, [selectedIndex, options.length, size, full]);

  useLayoutEffect(() => {
    if (thumb) placed.current = true;
  }, [thumb]);

  const group = (
    <div
      ref={groupRef}
      className={`segmented${tone === 'secondary' ? ' is-secondary' : ''}${size === 'sm' ? ' is-sm' : ''}${full ? ' is-full' : ''}`}
      role="group"
      aria-label={ariaLabel ?? label}
    >
      {thumb && (
        <span
          className={`segmented-thumb${placed.current ? ' is-placed' : ''}`}
          style={{ transform: `translateX(${thumb.left}px)`, width: `${thumb.width}px` }}
          aria-hidden="true"
        />
      )}
      {options.map(opt => (
        <button
          key={String(opt.value)}
          type="button"
          onClick={() => onChange(opt.value)}
          aria-pressed={value === opt.value}
          data-selected={value === opt.value}
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
