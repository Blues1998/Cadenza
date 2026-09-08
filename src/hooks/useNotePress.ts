import { useCallback, useEffect, useRef } from 'react';
import { audio } from '../utils/audio';

interface NotePressOptions {
  // How long a press has to last before the note stops decaying and holds.
  // Long enough not to fire on an ordinary tap, short enough that leaning on
  // a note feels like the cause of it.
  holdMs?: number;
}

// Press-and-hold behaviour shared by the instrument surfaces.
//
// A click used to play a note of fixed length, so the only thing you could do
// with an instrument on screen was trigger samples. Holding now holds: the
// pluck stops decaying and rings until you let go, which is what makes it
// possible to sit on a drone and play against it.
//
// Sliding to a new note while still down releases the old one and plays the
// new one, which is a strum across the strings or a glissando along the keys
// depending on which surface you are on.
export function useNotePress(play: (midi: number) => void, { holdMs = 300 }: NotePressOptions = {}) {
  const held = useRef<number | null>(null);
  const holdTimer = useRef<number | null>(null);

  const clearTimer = () => {
    if (holdTimer.current !== null) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  };

  const end = useCallback(() => {
    clearTimer();
    if (held.current !== null) {
      audio.releaseMidi(held.current);
      held.current = null;
    }
  }, []);

  const begin = useCallback((midi: number) => {
    end();
    play(midi);
    held.current = midi;
    holdTimer.current = window.setTimeout(() => {
      if (held.current === midi) audio.sustainMidi(midi);
    }, holdMs);
  }, [play, end, holdMs]);

  // Sliding onto a note is a fresh strike of that note, and re-arms the hold
  // so that stopping on one and staying there sustains it.
  const moveTo = useCallback((midi: number) => {
    if (held.current === midi) return;
    begin(midi);
  }, [begin]);

  // A pointer released outside the instrument — or off the window entirely —
  // must still let go of the note, or it rings until the safety cap.
  useEffect(() => {
    const stop = () => end();
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
    window.addEventListener('blur', stop);
    return () => {
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
      window.removeEventListener('blur', stop);
      end();
    };
  }, [end]);

  return { begin, moveTo, end, isDown: () => held.current !== null };
}

export default useNotePress;
