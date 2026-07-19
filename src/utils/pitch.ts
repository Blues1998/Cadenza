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

  // 2. YIN difference function: d[tau] = sum of squared differences at lag tau
  const diff = new Float32Array(halfLen);
  for (let tau = 1; tau < halfLen; tau++) {
    let sum = 0;
    for (let i = 0; i < halfLen; i++) {
      const delta = buffer[i] - buffer[i + tau];
      sum += delta * delta;
    }
    diff[tau] = sum;
  }

  // 3. Cumulative mean normalized difference — dips toward 0 at the true period
  const cmnd = new Float32Array(halfLen);
  cmnd[0] = 1;
  let runningSum = 0;
  for (let tau = 1; tau < halfLen; tau++) {
    runningSum += diff[tau];
    cmnd[tau] = runningSum === 0 ? 1 : (diff[tau] * tau) / runningSum;
  }

  // 4. Absolute threshold: take the FIRST dip below threshold, then walk down
  // to its local minimum. Restrict the lag search to the musical range.
  const threshold = 0.12;
  const minTau = Math.max(2, Math.floor(sampleRate / MAX_FREQUENCY));
  const maxTau = Math.min(halfLen - 2, Math.ceil(sampleRate / MIN_FREQUENCY));

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

  // No clear periodicity found — treat as unpitched noise
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
