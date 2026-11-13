// Animation loops run at the screen's rate, and phone screens now refresh at
// 90 or 120 Hz. Nothing in this app moves fast enough to need more than 60
// updates a second: drawing at 120 doubled the work of every frame (a WebView
// composites the whole screen each time) and, on the tuner, ran pitch
// detection twice as often as its smoothing was tuned for.
const MIN_GAP_MS = 1000 / 60 - 2;

/** A gate for a requestAnimationFrame loop: true at most ~60 times a second. */
export function frameGate(): (now?: number) => boolean {
  let last = -Infinity;
  return (now = performance.now()) => {
    if (now - last < MIN_GAP_MS) return false;
    last = now;
    return true;
  };
}
