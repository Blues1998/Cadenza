// Real-time Pitch Detection using Autocorrelation with parabolic interpolation

export interface PitchResult {
  frequency: number;
  note: string;
  cents: number;
  midi: number;
}

export function detectPitch(buffer: Float32Array, sampleRate: number): PitchResult | null {
  // 1. Check volume level using Root Mean Square (RMS)
  let rmsSum = 0;
  for (let i = 0; i < buffer.length; i++) {
    rmsSum += buffer[i] * buffer[i];
  }
  const rms = Math.sqrt(rmsSum / buffer.length);
  
  // If the signal is too quiet, don't try to detect a pitch (noise gating)
  if (rms < 0.008) {
    return null;
  }

  // 2. Perform Autocorrelation (correlating the signal with delayed versions of itself)
  const len = buffer.length;
  const maxLags = Math.floor(len / 2);
  const r = new Float32Array(maxLags);

  for (let lag = 0; lag < maxLags; lag++) {
    let sum = 0;
    for (let i = 0; i < maxLags; i++) {
      sum += buffer[i] * buffer[i + lag];
    }
    r[lag] = sum;
  }

  // 3. Skip the primary autocorrelation peak at lag = 0
  // Find the first point where correlation starts going back up (local minimum)
  let firstMinIndex = 0;
  for (let i = 0; i < maxLags - 1; i++) {
    if (r[i] < r[i + 1]) {
      firstMinIndex = i;
      break;
    }
  }

  // If we never find a local minimum, the signal is not periodic enough
  if (firstMinIndex === 0) {
    return null;
  }

  // 4. Find the highest peak (local maximum) after the local minimum
  let peakIndex = -1;
  let peakValue = -1;
  for (let i = firstMinIndex; i < maxLags - 1; i++) {
    if (r[i] > r[i - 1] && r[i] > r[i + 1]) {
      if (r[i] > peakValue) {
        peakValue = r[i];
        peakIndex = i;
      }
    }
  }

  // If no peak is found, or the peak is extremely weak, return null
  if (peakIndex === -1 || peakValue < 0.05 * r[0]) {
    return null;
  }

  // 5. Apply Parabolic Interpolation to find a sub-sample peak position
  // This gives high-precision frequency values even with small buffers
  let interpolatedPeak = peakIndex;
  const alpha = r[peakIndex - 1];
  const beta = r[peakIndex];
  const gamma = r[peakIndex + 1];
  
  const denominator = alpha - 2 * beta + gamma;
  if (denominator !== 0) {
    const offset = 0.5 * (alpha - gamma) / denominator;
    interpolatedPeak = peakIndex + offset;
  }

  // Calculate fundamental frequency
  const frequency = sampleRate / interpolatedPeak;

  // Filter out frequencies outside the reasonable singing/instrument range
  if (frequency < 50 || frequency > 1600) {
    return null;
  }

  // 6. Map frequency to MIDI note and cents offset
  // MIDI formula: n = 12 * log2(f / 440) + 69
  const midiDouble = 12 * Math.log2(frequency / 440) + 69;
  const midi = Math.round(midiDouble);
  const cents = Math.round((midiDouble - midi) * 100);

  // Note mapping
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const noteIndex = midi % 12;
  const octave = Math.floor(midi / 12) - 1;
  const noteName = noteNames[noteIndex] + octave;

  return {
    frequency,
    note: noteName,
    cents,
    midi
  };
}
