// Low-latency Audio Synthesis Engine using the native Web Audio API
import { midiToFreq } from './musicTheory';

class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;

  constructor() {
    // Context is initialized on first user interaction to comply with browser autoplay policies
  }

  // Initialize the audio context if it hasn't been already
  public init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.6, this.ctx.currentTime); // default comfortable volume
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  // Get current audio clock time
  public getCurrentTime(): number {
    this.init();
    return this.ctx ? this.ctx.currentTime : 0;
  }

  // Total delay between scheduling a sound and it reaching the listener's ears.
  // Sounds scheduled at audio-clock time T are physically heard at T + this value.
  // Queried live because it changes when the output device changes (e.g. Bluetooth).
  public getOutputLatency(): number {
    this.init();
    if (!this.ctx) return 0;
    const base = this.ctx.baseLatency ?? 0;
    // outputLatency is not implemented in all browsers (e.g. Safari)
    const output = (this.ctx as AudioContext & { outputLatency?: number }).outputLatency ?? 0;
    return base + output;
  }

  // Play a single note using standard MIDI index number
  public playMidi(midi: number, duration: number = 2.0, time?: number) {
    const freq = midiToFreq(midi);
    this.playNote(freq, duration, time);
  }

  // Play a chords of MIDI numbers
  public playChord(midis: number[], duration: number = 2.0, time?: number) {
    const playTime = time !== undefined ? time : this.getCurrentTime();
    midis.forEach((midi) => {
      this.playMidi(midi, duration, playTime);
    });
  }

  // Core sound synthesis: Acoustic Guitar physical modeling (Additive Overtones + Wood Pluck Noise)
  public playNote(frequency: number, duration: number = 2.0, time?: number) {
    this.init();
    if (!this.ctx || !this.masterGain) return;

    const now = time !== undefined ? time : this.ctx.currentTime;

    // Scale duration based on pitch (high notes decay faster, low notes sustain longer)
    const pitchScale = Math.pow(150 / frequency, 0.4);
    const finalDuration = Math.max(0.4, Math.min(4.0, duration * pitchScale));

    const pluckGain = this.ctx.createGain();
    pluckGain.connect(this.masterGain);

    // Harmonics layout: mimicking acoustic guitar string energy transfer
    // We add sine and triangle waves at integer overtones (fundamental, 2nd, 3rd, etc.)
    const harmonics = [
      { ratio: 1.0, gain: 0.55, decay: 1.0, type: 'sine' as OscillatorType },
      { ratio: 2.0, gain: 0.25, decay: 0.5, type: 'triangle' as OscillatorType },
      { ratio: 3.0, gain: 0.12, decay: 0.28, type: 'sine' as OscillatorType },
      { ratio: 4.0, gain: 0.06, decay: 0.14, type: 'triangle' as OscillatorType },
      { ratio: 5.0, gain: 0.03, decay: 0.08, type: 'sine' as OscillatorType },
      { ratio: 6.0, gain: 0.015, decay: 0.04, type: 'sine' as OscillatorType },
    ];

    harmonics.forEach(({ ratio, gain: gainRatio, decay: decayRatio, type }) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const oscGain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(frequency * ratio, now);

      const attackTime = 0.003; // Instant mechanical string pluck (3ms)
      const decayTime = finalDuration * decayRatio;

      oscGain.gain.setValueAtTime(0, now);
      oscGain.gain.linearRampToValueAtTime(gainRatio, now + attackTime);
      oscGain.gain.exponentialRampToValueAtTime(0.0001, now + attackTime + decayTime);

      osc.connect(oscGain);
      oscGain.connect(pluckGain);

      osc.start(now);
      osc.stop(now + attackTime + decayTime + 0.1);
    });

    // Pick attack simulation: brief wooden tap/pick noise using high-pass filtered white noise
    try {
      const sampleRate = this.ctx.sampleRate;
      const noiseDuration = 0.015; // 15ms
      const bufferSize = sampleRate * noiseDuration;
      const buffer = this.ctx.createBuffer(1, bufferSize, sampleRate);
      const data = buffer.getChannelData(0);
      
      // Populate random white noise values
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noiseNode = this.ctx.createBufferSource();
      noiseNode.buffer = buffer;

      const noiseFilter = this.ctx.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.value = 1200; // woody sound center
      noiseFilter.Q.value = 1.5;

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.25, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.012);

      noiseNode.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(pluckGain);

      noiseNode.start(now);
      noiseNode.stop(now + 0.02);
    } catch (e) {
      console.warn('Could not generate acoustic pick transient noise:', e);
    }
  }

  // Play a crisp metronome woodblock click (fully schedulable in advance)
  public playClick(time: number, accented: boolean) {
    this.init();
    if (!this.ctx || !this.masterGain) return;

    const osc = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();
    
    osc.connect(gainNode);
    gainNode.connect(this.masterGain);

    // Woody block sounds are simulated by sine waves around 800 - 1200Hz
    const freq = accented ? 1100 : 750;
    osc.frequency.setValueAtTime(freq, time);

    gainNode.gain.setValueAtTime(0, time);
    gainNode.gain.linearRampToValueAtTime(accented ? 0.5 : 0.35, time + 0.001);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, time + 0.045); // short decay

    osc.start(time);
    osc.stop(time + 0.05);
  }

  // Adjust master volume (0.0 to 1.0)
  public setVolume(volume: number) {
    this.init();
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.linearRampToValueAtTime(
        Math.max(0, Math.min(1, volume)),
        this.ctx.currentTime + 0.05
      );
    }
  }

  // Returns the AudioContext state (for visual indicator if suspended)
  public getContextState(): string {
    return this.ctx ? this.ctx.state : 'uninitialized';
  }
}

export const audio = new AudioEngine();
