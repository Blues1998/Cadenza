// Real-time pitch detection using the YIN algorithm (de Cheveigné & Kawahara, 2002).
// YIN picks the FIRST lag whose normalized difference dips below a threshold,
// which resists the octave-up errors that plain autocorrelation peak-picking
// suffers on harmonic-rich sources like guitar.

export interface PitchResult {
  frequency: number;
  note: string;
  cents: number;
  midi: number;
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const MIN_FREQUENCY = 50;   // below guitar drop-D territory
const MAX_FREQUENCY = 1600; // above typical singing / fretted range

function frequencyToResult(frequency: number): PitchResult {
  // MIDI formula: n = 12 * log2(f / 440) + 69
  const midiDouble = 12 * Math.log2(frequency / 440) + 69;
  const midi = Math.round(midiDouble);
  const cents = Math.round((midiDouble - midi) * 100);
  const octave = Math.floor(midi / 12) - 1;
  return {
    frequency,
    note: NOTE_NAMES[midi % 12] + octave,
    cents,
    midi
  };
}

// Scratch buffers for YIN difference and CMND calculations. Reused across
// calls to eliminate 120-240 Float32Array allocations per second in RAF loops.
let diffScratch = new Float32Array(2048);
let cmndScratch = new Float32Array(2048);

function ensureScratchCapacity(len: number) {
  if (diffScratch.length < len) {
    const nextSize = Math.max(len, diffScratch.length * 2);
    diffScratch = new Float32Array(nextSize);
    cmndScratch = new Float32Array(nextSize);
  }
}

export function detectPitch(buffer: Float32Array, sampleRate: number): PitchResult | null {
  // 1. Noise gate: skip frames that are too quiet to contain a real note
  let rmsSum = 0;
  for (let i = 0; i < buffer.length; i++) {
    rmsSum += buffer[i] * buffer[i];
  }
  const rms = Math.sqrt(rmsSum / buffer.length);
  if (rms < 0.008) {
    return null;
  }

  const halfLen = Math.floor(buffer.length / 2);

  // Lags outside the musical range are never consulted by the search below
  // (step 4) or its interpolation (step 5), which together only ever read
  // up to index maxTau + 1, so the two O(halfLen) x O(halfLen) loops below
  // only need to compute that far instead of all the way to halfLen, saving
  // a meaningful fraction of this function's dominant cost on every
  // animation frame it runs on. minTau/maxTau are computed here (rather than
  // after, alongside the threshold search that originally used them) purely
  // so computeLen can be derived before the loops that need it.
  const minTau = Math.max(2, Math.floor(sampleRate / MAX_FREQUENCY));
  const maxTau = Math.min(halfLen - 2, Math.ceil(sampleRate / MIN_FREQUENCY));
  const computeLen = maxTau + 2; // +1 for the inclusive bound, +1 for gamma's lookahead in step 5

  ensureScratchCapacity(computeLen);
  const diff = diffScratch;

  // 2. YIN difference function: d[tau] = sum of squared differences at lag tau
  for (let tau = 1; tau < computeLen; tau++) {
    let sum = 0;
    for (let i = 0; i < halfLen; i++) {
      const delta = buffer[i] - buffer[i + tau];
      sum += delta * delta;
    }
    diff[tau] = sum;
  }

  // 3. Cumulative mean normalized difference, dips toward 0 at the true period
  const cmnd = cmndScratch;
  cmnd[0] = 1;
  let runningSum = 0;
  for (let tau = 1; tau < computeLen; tau++) {
    runningSum += diff[tau];
    cmnd[tau] = runningSum === 0 ? 1 : (diff[tau] * tau) / runningSum;
  }

  // 4. Absolute threshold: take the FIRST dip below threshold, then walk down
  // to its local minimum. Restrict the lag search to the musical range.
  const threshold = 0.12;

  let tauEstimate = -1;
  for (let tau = minTau; tau <= maxTau; tau++) {
    if (cmnd[tau] < threshold) {
      while (tau + 1 <= maxTau && cmnd[tau + 1] < cmnd[tau]) {
        tau++;
      }
      tauEstimate = tau;
      break;
    }
  }

  // No clear periodicity found, treat as unpitched noise
  if (tauEstimate === -1) {
    return null;
  }

  // 5. Parabolic interpolation around the dip for sub-sample period accuracy
  let betterTau = tauEstimate;
  const alpha = cmnd[tauEstimate - 1];
  const beta = cmnd[tauEstimate];
  const gamma = cmnd[tauEstimate + 1];
  const denominator = alpha - 2 * beta + gamma;
  if (denominator !== 0) {
    betterTau = tauEstimate + 0.5 * (alpha - gamma) / denominator;
  }

  const frequency = sampleRate / betterTau;
  if (frequency < MIN_FREQUENCY || frequency > MAX_FREQUENCY) {
    return null;
  }

  return frequencyToResult(frequency);
}

// Smooths raw per-frame detections into a stable reading:
// - the displayed note only switches after several consecutive frames agree
//   (hysteresis), so it no longer flickers every 1/60th of a second
// - frequency/cents are exponentially smoothed while the note is held
// - brief dropouts (e.g. between guitar pluck cycles) hold the last reading
export class PitchStabilizer {
  private displayed: PitchResult | null = null;
  private smoothedFrequency = 0;
  private candidateMidi: number | null = null;
  private candidateFrames = 0;
  private silentFrames = 0;

  // Frames of agreement required before switching to a new note
  private static readonly SWITCH_FRAMES = 3;
  // Frames of silence tolerated before clearing the reading
  private static readonly HOLD_FRAMES = 8;
  // EMA factor for frequency smoothing (higher = more responsive)
  private static readonly SMOOTHING = 0.3;

  update(raw: PitchResult | null): PitchResult | null {
    if (!raw) {
      this.silentFrames++;
      if (this.silentFrames > PitchStabilizer.HOLD_FRAMES) {
        this.reset();
      }
      return this.displayed ? { ...this.displayed } : null;
    }
    this.silentFrames = 0;

    if (this.displayed !== null && raw.midi === this.displayed.midi) {
      // Same note: smooth the frequency and recompute cents against it
      this.candidateMidi = null;
      this.candidateFrames = 0;
      this.smoothedFrequency += PitchStabilizer.SMOOTHING * (raw.frequency - this.smoothedFrequency);
      const midiDouble = 12 * Math.log2(this.smoothedFrequency / 440) + 69;
      this.displayed = {
        ...this.displayed,
        frequency: this.smoothedFrequency,
        cents: Math.round((midiDouble - this.displayed.midi) * 100)
      };
    } else {
      // Different note: only switch after consecutive frames agree
      if (raw.midi === this.candidateMidi) {
        this.candidateFrames++;
      } else {
        this.candidateMidi = raw.midi;
        this.candidateFrames = 1;
      }

      const required = this.displayed === null ? 2 : PitchStabilizer.SWITCH_FRAMES;
      if (this.candidateFrames >= required) {
        this.displayed = { ...raw };
        this.smoothedFrequency = raw.frequency;
        this.candidateMidi = null;
        this.candidateFrames = 0;
      }
    }

    return this.displayed ? { ...this.displayed } : null;
  }

  reset(): void {
    this.displayed = null;
    this.smoothedFrequency = 0;
    this.candidateMidi = null;
    this.candidateFrames = 0;
    this.silentFrames = 0;
  }
}

// Smoothing for a singing voice, which wants nearly the opposite of the
// instrument stabilizer above. A string holds one pitch, so snapping to a note
// and holding it is right. A voice slides into notes, wobbles with vibrato and
// drifts, and that movement is exactly what a singer needs to see, snapping
// would draw a staircase over it.
//
// So this keeps the pitch continuous and only removes what is not the voice:
// - a running median over a few frames, which drops the one-frame octave jumps
//   YIN makes on breathy onsets and consonants without flattening a slide;
// - a short hold through dropouts, so a trace does not break on every
//   consonant, and no longer than that, so a breath reads as a breath.
export class VoiceSmoother {
  private recent: number[] = [];
  private silentFrames = 0;

  private static readonly WINDOW = 5;
  private static readonly HOLD_FRAMES = 4;

  update(raw: PitchResult | null): PitchResult | null {
    if (!raw) {
      this.silentFrames++;
      if (this.silentFrames > VoiceSmoother.HOLD_FRAMES) this.recent = [];
      return this.current();
    }
    this.silentFrames = 0;
    this.recent.push(12 * Math.log2(raw.frequency / 440) + 69);
    if (this.recent.length > VoiceSmoother.WINDOW) this.recent.shift();
    return this.current();
  }

  private current(): PitchResult | null {
    // Two agreeing frames before anything is shown, so a lone blip never draws.
    if (this.recent.length < 2) return null;
    const sorted = [...this.recent].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    return frequencyToResult(440 * Math.pow(2, (median - 69) / 12));
  }

  reset(): void {
    this.recent = [];
    this.silentFrames = 0;
  }
}
