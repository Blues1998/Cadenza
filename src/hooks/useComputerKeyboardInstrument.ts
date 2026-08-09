import { useCallback, useEffect, useRef, useState } from 'react';

// Classic "computer keyboard as piano" layout, same idea as GarageBand's
// Musical Typing: the home row plays one chromatic octave of white keys,
// the row above fills in the black keys between them. Nothing sits above
// the D-F or J-K gaps because that's exactly where a real keyboard has no
// black key either (E/F and B/C).
export const KEY_TO_SEMITONE: Record<string, number> = {
  a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6, g: 7, y: 8, h: 9, u: 10, j: 11, k: 12,
};

// Reverse lookup — given a semitone offset (0-12), which physical key plays
// it. Used by anything that needs to tell the player "press this key"
// rather than a note name, since this app's mapping is custom.
export const SEMITONE_TO_KEY: Record<number, string> = Object.fromEntries(
  Object.entries(KEY_TO_SEMITONE).map(([key, semitone]) => [semitone, key.toUpperCase()])
);

// Clamped so every reachable note falls within the app's visible 3-octave
// piano/fretboard range (MIDI 48-84) — nothing plays a note with no key
// or fret lit up to show for it.
const MIN_OCTAVE = 3;
const MAX_OCTAVE = 5;
const DEFAULT_OCTAVE = 4; // "home" octave — A key = middle C (MIDI 60)

const isTypingTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || target.isContentEditable;
};

// Lets any lab drive its existing onPlayNote(midi) handler from the
// keyboard instead of only mouse/touch clicks — no separate audio path,
// it just triggers the exact same note-play callback a click would.
export function useComputerKeyboardInstrument(onPlayNote: (midi: number) => void, enabled: boolean = true) {
  const [octave, setOctaveState] = useState(DEFAULT_OCTAVE);
  const octaveRef = useRef(DEFAULT_OCTAVE);
  const heldKeysRef = useRef<Set<string>>(new Set());
  const onPlayNoteRef = useRef(onPlayNote);
  onPlayNoteRef.current = onPlayNote;

  const changeOctave = useCallback((delta: number) => {
    const next = Math.max(MIN_OCTAVE, Math.min(MAX_OCTAVE, octaveRef.current + delta));
    octaveRef.current = next;
    setOctaveState(next);
  }, []);

  // Set the octave directly (clamped), e.g. locking it to a song's
  // homeOctave before a Song Hero session starts.
  const setOctave = useCallback((next: number) => {
    const clamped = Math.max(MIN_OCTAVE, Math.min(MAX_OCTAVE, next));
    octaveRef.current = clamped;
    setOctaveState(clamped);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const heldKeys = heldKeysRef.current;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat || isTypingTarget(e.target)) return;
      const key = e.key.toLowerCase();

      if (key === 'z') { e.preventDefault(); changeOctave(-1); return; }
      if (key === 'x') { e.preventDefault(); changeOctave(1); return; }

      const semitone = KEY_TO_SEMITONE[key];
      if (semitone === undefined || heldKeys.has(key)) return;
      heldKeys.add(key);
      e.preventDefault();

      onPlayNoteRef.current((octaveRef.current + 1) * 12 + semitone);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      heldKeys.delete(e.key.toLowerCase());
    };

    // Held keys reset on blur too, otherwise alt-tabbing away mid-press
    // leaves that key permanently "stuck" and unable to retrigger.
    const handleBlur = () => heldKeys.clear();

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
      heldKeys.clear();
    };
  }, [enabled, changeOctave]);

  return { octave, setOctave };
}
