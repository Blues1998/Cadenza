import { useEffect, useRef, useState } from 'react';
import { GUITAR_STRINGS, GUITAR_CHORD_SHAPES, NOTE_NAMES, chordShapeMidis } from '../utils/musicTheory';
import type { GuitarChordShape } from '../utils/musicTheory';

// Fretting-hand keys: hold one to "fret" that chord shape across all six
// strings. The number row mirrors a real fretting hand, which can only
// ever hold one shape at a time.
const SHAPE_KEY_TO_CHORD_ID: Record<string, string> = {
  '1': 'C', '2': 'G', '3': 'D', '4': 'A', '5': 'E', '6': 'Am', '7': 'Em', '8': 'Dm',
};

// Picking-hand keys: one per string, low to high, left to right on the
// keyboard — matching GUITAR_STRINGS' index order (0 = high E ... 5 = low E).
const PICK_KEY_TO_STRING_INDEX: Record<string, number> = {
  z: 5, x: 4, c: 3, v: 2, b: 1, n: 0,
};

const isTypingTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || target.isContentEditable;
};

const SHAPES_BY_ID = new Map(GUITAR_CHORD_SHAPES.map(s => [s.id, s]));

// Drives real chord + fingerstyle guitar playing from the keyboard: hold a
// shape key to fret a chord, tap pick keys in any order/rhythm to sound
// individual strings of it — a fast sweep across pick keys is a strum, a
// slower deliberate sequence is fingerpicking. With no shape held, pick
// keys ring their string open, same as an unfretted string would.
export function useGuitarChordKeyboard(
  onPlayNote: (midi: number, chordId?: string | null) => void,
  enabled: boolean = true
) {
  const [heldShapeId, setHeldShapeId] = useState<string | null>(null);
  // Stack of currently-held shape keys (most recent on top), so releasing
  // one shape correctly falls back to another still-held shape key instead
  // of dropping straight to "no shape" if two were briefly pressed at once.
  const shapeStackRef = useRef<string[]>([]);
  const heldPickKeysRef = useRef<Set<string>>(new Set());
  const onPlayNoteRef = useRef(onPlayNote);
  onPlayNoteRef.current = onPlayNote;

  useEffect(() => {
    if (!enabled) {
      shapeStackRef.current = [];
      heldPickKeysRef.current.clear();
      setHeldShapeId(null);
      return;
    }
    const shapeStack = shapeStackRef.current;
    const heldPickKeys = heldPickKeysRef.current;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat || isTypingTarget(e.target)) return;
      const key = e.key.toLowerCase();

      const chordId = SHAPE_KEY_TO_CHORD_ID[key];
      if (chordId) {
        e.preventDefault();
        if (!shapeStack.includes(chordId)) shapeStack.push(chordId);
        setHeldShapeId(chordId);
        return;
      }

      const stringIndex = PICK_KEY_TO_STRING_INDEX[key];
      if (stringIndex === undefined || heldPickKeys.has(key)) return;
      heldPickKeys.add(key);
      e.preventDefault();

      const shape = shapeStack.length > 0 ? SHAPES_BY_ID.get(shapeStack[shapeStack.length - 1]) : undefined;
      const fret = shape ? shape.frets[stringIndex] : 0; // no shape held -> string rings open
      if (fret === null) return; // muted in this shape
      onPlayNoteRef.current(GUITAR_STRINGS[stringIndex].midi + fret, shape?.id ?? null);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      heldPickKeys.delete(key);

      const chordId = SHAPE_KEY_TO_CHORD_ID[key];
      if (chordId) {
        const idx = shapeStack.indexOf(chordId);
        if (idx !== -1) shapeStack.splice(idx, 1);
        setHeldShapeId(shapeStack.length > 0 ? shapeStack[shapeStack.length - 1] : null);
      }
    };

    const handleBlur = () => {
      heldPickKeys.clear();
      shapeStack.length = 0;
      setHeldShapeId(null);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
      heldPickKeys.clear();
      shapeStack.length = 0;
    };
  }, [enabled]);

  const heldShape: GuitarChordShape | null = heldShapeId ? SHAPES_BY_ID.get(heldShapeId) ?? null : null;
  const heldShapeMidis = heldShape ? chordShapeMidis(heldShape.id) : [];
  const heldShapeRootMidis = heldShape
    ? heldShapeMidis.filter(m => NOTE_NAMES[m % 12] === heldShape.root)
    : [];

  return { heldShape, heldShapeMidis, heldShapeRootMidis };
}
