import { SUNBURST_REVEAL_EVENT, useSunburst } from '../utils/sunburst';

/**
 * For the header's ♯♭ mark. Once the Sunburst finish is earned the mark turns
 * gold, and the first tap explains why instead of doing its usual job.
 */
export function useGoldMark(onUsual: () => void): { gold: boolean; onClick: () => void } {
  const { earned, revealed } = useSunburst();
  return {
    gold: earned !== null,
    onClick: () => {
      if (earned && !revealed) window.dispatchEvent(new CustomEvent(SUNBURST_REVEAL_EVENT));
      else onUsual();
    }
  };
}
