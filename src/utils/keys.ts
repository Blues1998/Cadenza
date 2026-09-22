// Whether a keystroke belongs to whatever is being typed into.
//
// Lived in three hooks in three slightly different versions, which is three
// chances for the space bar to start the metronome while somebody is naming a
// loop. One copy, and everything that listens on the window uses it.
export const isTypingTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || target.isContentEditable;
};
