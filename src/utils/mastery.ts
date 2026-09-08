// Per-item mastery: what you are actually good at, one item at a time.
//
// progress.ts counts achievements — a single number for "intervals answered
// correctly". That is enough to unlock a Journey level and useless for
// deciding what to ask next, because it cannot tell a perfect fifth you nail
// every time from a minor sixth you have been guessing at for a week. This
// store keeps a record per item, so a drill can ask for the thing you are
// worst at instead of rolling a die.
//
// Item ids are opaque strings — `interval:7`, `chord:Major Triad`. Nothing in
// here knows any music theory, so the same store backs any drill with a set
// of things to learn.

const STORAGE_KEY = 'cadenza-mastery-v1';
const CHANGE_EVENT = 'cadenza-mastery-change';

export interface ItemStat {
  seen: number;
  correct: number;
  streak: number;           // consecutive correct answers, for a run readout
  box: number;              // Leitner box — how far apart this item is spaced
  ewma: number;             // recency-weighted accuracy, 0..1
  peak: number;             // the highest mastery this item has ever reached
  lastSeenAttempt: number;  // value of `attempts` when it was last asked
  lastSeenAt: number;       // epoch ms — for a review session that spans days
}

interface MasteryData {
  attempts: number;         // every graded answer, across all items
  items: Record<string, ItemStat>;
}

// How much the newest answer moves the running accuracy — the last nine or so
// answers are what decide an item's score.
//
// Chosen by measuring both ends of the trade-off rather than by feel. Faster
// (0.34) and the reading is 13 points off the true rate and jumps 10 points an
// answer, so two items you are equally good at show wildly different bars.
// Slower (0.10) and it takes eight questions on one item to register that you
// have improved — and since any one item comes up about a twelfth of the time,
// that is most of a session before the bar admits it. At 0.20 the reading sits
// within about 10 points, moves 6 an answer, and notices real improvement in
// four.
const EWMA_ALPHA = 0.20;

// Mastery is held down while an item is barely tested, so three correct
// answers out of three read as 0.6 rather than 1.0. On a four-way multiple
// choice a guess is right a quarter of the time, and an item the drill
// believes is finished stops being asked at all.
const CONFIDENCE_K = 2;

// How many other questions should pass before an item comes back, by box. A
// session here is minutes long, so spacing is counted in questions rather
// than in hours — between two answers the wall clock barely moves.
const BOX_SPACING = [0, 2, 4, 7, 12, 20];

// Even a fully mastered item keeps a small share of the draw. Recognition you
// never revisit decays, and a drill that permanently retires its easy items
// gets harder every question until it is nothing but the things you hate.
const MIN_URGENCY = 0.08;

// An item you have never been asked is worth more than one you are merely bad
// at: until it has been seen once there is nothing to schedule.
const NEW_ITEM_WEIGHT = 3;

const blank = (): ItemStat => ({
  seen: 0,
  correct: 0,
  streak: 0,
  box: 0,
  ewma: 0,
  peak: 0,
  lastSeenAttempt: -Infinity,
  lastSeenAt: 0
});

const load = (): MasteryData => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.items === 'object' && parsed.items !== null) {
        return { attempts: Number(parsed.attempts) || 0, items: parsed.items };
      }
    }
  } catch { /* corrupted or unavailable — start fresh */ }
  return { attempts: 0, items: {} };
};

let cache: MasteryData = load();

const persist = (): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch { /* private browsing — in-memory only */ }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
};

// How well this item is known, 0..1. Recent accuracy, discounted by how
// little evidence there is for it.
export function masteryOf(stat: ItemStat | undefined): number {
  if (!stat || stat.seen === 0) return 0;
  return stat.ewma * (stat.seen / (stat.seen + CONFIDENCE_K));
}

export function getStat(itemId: string): ItemStat | undefined {
  return cache.items[itemId];
}

export function getMastery(itemId: string): number {
  return masteryOf(cache.items[itemId]);
}

export function getAttemptCount(): number {
  return cache.attempts;
}

// Grade one answer. Called at the moment of the answer, right or wrong —
// a miss is the more informative of the two and has to be recorded.
export function recordAttempt(itemId: string, correct: boolean): void {
  cache.attempts += 1;
  const prev = cache.items[itemId] ?? blank();

  const next: ItemStat = {
    seen: prev.seen + 1,
    correct: prev.correct + (correct ? 1 : 0),
    streak: correct ? prev.streak + 1 : 0,
    // A miss sends the item back to the front of the queue. Classic Leitner,
    // and right here: the answer you just got wrong is the one to ask again.
    box: correct ? Math.min(prev.box + 1, BOX_SPACING.length - 1) : 0,
    ewma: prev.seen === 0
      ? (correct ? 1 : 0)
      : prev.ewma + EWMA_ALPHA * ((correct ? 1 : 0) - prev.ewma),
    peak: prev.peak ?? 0,
    lastSeenAttempt: cache.attempts,
    lastSeenAt: Date.now()
  };
  next.peak = Math.max(next.peak, masteryOf(next));

  cache.items[itemId] = next;
  persist();
}

// How much this item deserves to be the next question.
const weightOf = (itemId: string): number => {
  const stat = cache.items[itemId];
  if (!stat || stat.seen === 0) return NEW_ITEM_WEIGHT;

  // Squared, so the gap between an item at 0.3 and one at 0.6 is wider than
  // the difference in their scores. Weak items should dominate the draw, not
  // merely edge ahead of strong ones.
  const urgency = MIN_URGENCY + (1 - MIN_URGENCY) * Math.pow(1 - masteryOf(stat), 2);

  // An item asked more recently than its box allows is suppressed rather than
  // barred: answering three fifths in a row teaches nothing, but if fifths are
  // genuinely the weak spot they should still come back soon.
  const spacing = BOX_SPACING[Math.min(stat.box, BOX_SPACING.length - 1)];
  const gap = cache.attempts - stat.lastSeenAttempt;
  const readiness = spacing === 0 ? 1 : Math.min(1, gap / spacing);

  return Math.max(urgency * readiness, 0.001);
};

export interface PickOptions {
  exclude?: string | null;  // the item just asked — never twice in a row
}

// Choose the next item to ask: weighted toward what you are weakest at and
// what is due, rather than uniformly at random. Still a draw and not a sort,
// because a drill that always asks your single worst item is a drill you can
// predict, and one bad answer would lock you in a loop on it.
export function pickNextItem(itemIds: string[], { exclude }: PickOptions = {}): string | null {
  if (itemIds.length === 0) return null;

  const pool = exclude && itemIds.length > 1
    ? itemIds.filter(id => id !== exclude)
    : itemIds;

  const weights = pool.map(weightOf);
  const total = weights.reduce((sum, w) => sum + w, 0);
  if (!(total > 0)) return pool[Math.floor(Math.random() * pool.length)];

  let roll = Math.random() * total;
  for (let i = 0; i < pool.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

export interface LadderOptions {
  seed?: number;        // how many items are in play from the very start
  masteredAt?: number;  // mastery at which an item counts as known
  minSeen?: number;     // and the evidence required to make that call
}

// How far along an ordered curriculum you have earned your way. The next item
// unlocks once all but one of the items already in play are known — all-but-one
// rather than all, so a single item you find genuinely hard (the tritone, for
// most people) slows the ladder down instead of stopping it forever.
//
// Measured on peak mastery, never current, so the ladder only ever goes
// forwards. Current mastery is a recency-weighted average and dips on any bad
// run; scored on that, a curriculum takes things away from you for having a
// bad five minutes, which is both wrong and demoralising. Forgetting is what
// the weighting in pickNextItem is for — it will ask you again.
export function unlockedCount(
  ladder: string[],
  { seed = 3, masteredAt = 0.7, minSeen = 4 }: LadderOptions = {}
): number {
  let unlocked = Math.min(seed, ladder.length);
  while (unlocked < ladder.length) {
    let known = 0;
    for (let i = 0; i < unlocked; i++) {
      const stat = cache.items[ladder[i]];
      if (stat && stat.seen >= minSeen && (stat.peak ?? 0) >= masteredAt) known++;
    }
    if (known < unlocked - 1) break;
    unlocked++;
  }
  return unlocked;
}

export function resetMastery(): void {
  cache = { attempts: 0, items: {} };
  persist();
}

export function subscribeMastery(callback: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, callback);
  // Another tab drilling the same items is the same learner
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      cache = load();
      callback();
    }
  };
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback);
    window.removeEventListener('storage', onStorage);
  };
}
