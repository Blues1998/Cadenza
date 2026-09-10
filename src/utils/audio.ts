// Low-latency Audio Synthesis Engine using the native Web Audio API
import { midiToFreq } from './musicTheory';

// A note that is still ringing and can still be changed. Held so a press can
// flatten a pluck's decay into a sustain and let go of it later.
interface Voice {
  midi: number;
  parts: { osc: OscillatorNode; gain: GainNode; peak: number }[];
  sustained: boolean;
}

// A plucked string cannot really be sustained — it decays, that is what a
// pluck is. Holding a note therefore does not extend the pluck so much as
// bow it: the envelope stops falling and settles at a fraction of its peak,
// weighted so the fundamental survives and the bright upper partials do not.
// That is what a held string sounds like as it rings out.
const SUSTAIN_LEVEL = [0.62, 0.3, 0.14, 0.06, 0.03, 0.015];
const RELEASE_S = 0.42;
// Nothing should ring forever if a pointerup is somehow missed.
const MAX_SUSTAIN_S = 30;

// What an up-stroke is: the top few strings, crossed faster, ringing shorter.
const UP_STRINGS = 4;
const UP_HASTE = 0.66;
const UP_RING = 0.72;

class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private voices = new Map<number, Voice>();
  private nextVoiceId = 1;
  // Most recent voice per MIDI note, so an instrument surface can hold the
  // note it just asked a lab to play without the id being threaded back
  // through the lab's own callback.
  private latestByMidi = new Map<number, number>();

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

  // Expose the context + master input so labs can run custom nodes
  // (e.g. sustained oscillators) while still respecting the master volume
  public getMasterBus(): { ctx: AudioContext; input: AudioNode } | null {
    this.init();
    if (!this.ctx || !this.masterGain) return null;
    return { ctx: this.ctx, input: this.masterGain };
  }

  // Play a single note using standard MIDI index number
  public playMidi(midi: number, duration: number = 2.0, time?: number) {
    const freq = midiToFreq(midi);
    this.playNote(freq, duration, time, midi);
  }

  // Stop a plucked note decaying and hold it, for as long as a key or fret is
  // held down. No-op if that note is not currently ringing.
  public sustainMidi(midi: number) {
    const id = this.latestByMidi.get(midi);
    if (id === undefined) return;
    const voice = this.voices.get(id);
    if (!voice || voice.sustained || !this.ctx) return;
    voice.sustained = true;
    const now = this.ctx.currentTime;

    voice.parts.forEach(({ osc, gain, peak }, i) => {
      const level = peak * (SUSTAIN_LEVEL[i] ?? 0.02);
      gain.gain.cancelScheduledValues(now);
      // From wherever the decay had got to, so the handover is inaudible
      gain.gain.setValueAtTime(Math.max(gain.gain.value, 0.0001), now);
      gain.gain.linearRampToValueAtTime(level, now + 0.09);
      // Rescheduling stop() on a still-running oscillator moves its end
      osc.stop(now + MAX_SUSTAIN_S + RELEASE_S);
    });

    window.setTimeout(() => this.releaseMidi(midi), MAX_SUSTAIN_S * 1000);
  }

  // Let a held note go. It decays rather than cutting off.
  public releaseMidi(midi: number) {
    const id = this.latestByMidi.get(midi);
    if (id === undefined) return;
    const voice = this.voices.get(id);
    if (!voice || !voice.sustained || !this.ctx) return;
    const now = this.ctx.currentTime;

    voice.parts.forEach(({ osc, gain }) => {
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(Math.max(gain.gain.value, 0.0001), now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + RELEASE_S);
      osc.stop(now + RELEASE_S + 0.05);
    });

    this.voices.delete(id);
    if (this.latestByMidi.get(midi) === id) this.latestByMidi.delete(midi);
  }

  // Play a chords of MIDI numbers
  /**
   * A chord struck one string at a time, low to high.
   *
   * playChord starts every note on the same instant, which is a piano. A
   * guitar cannot do that: the pick crosses the strings, and the gap is what
   * makes two voicings of the same chord sound like two different things
   * rather than the same six notes twice. Slow enough here to hear the shape
   * being laid down, which is the point when you are auditioning one.
   */
  public playStrum(midis: number[], duration: number = 2.2, spread: number = 0.045, time?: number) {
    this.init();
    const start = time !== undefined ? time : this.getCurrentTime();
    // By pitch, which is the string order for every shape we can draw.
    [...midis].sort((a, b) => a - b).forEach((midi, i) => {
      this.playMidi(midi, duration, start + i * spread);
    });
  }

  /**
   * One stroke of a strumming pattern.
   *
   * A down-stroke and an up-stroke are not the same event played backwards.
   * The arm falls through all six strings on the way down and clips the top
   * three or four on the way back, faster and shorter, because the wrist is
   * already returning. Written as one method because a pattern is a sequence
   * of these and the difference between them is most of what a pattern sounds
   * like.
   *
   * A muted stroke has no pitch at all: the fretting hand is resting on the
   * strings, so what you hear is the pick crossing them.
   */
  public playStroke(
    midis: number[],
    stroke: 'D' | 'U' | 'X',
    duration: number = 1.4,
    spread: number = 0.02,
    time?: number
  ) {
    this.init();
    const start = time !== undefined ? time : this.getCurrentTime();
    if (stroke === 'X') return this.playMuted(start);

    // By pitch, which is the string order for every shape we can draw.
    const byPitch = [...midis].sort((a, b) => a - b);
    // Up-strokes catch the thin strings. Taking the top four rather than all
    // six is what keeps a pattern from sounding like the same chord hammered
    // eight times: the ups are lighter, and lighter here means fewer strings.
    const ordered = stroke === 'U' ? byPitch.slice(-UP_STRINGS).reverse() : byPitch;
    const gap = stroke === 'U' ? spread * UP_HASTE : spread;
    const ring = stroke === 'U' ? duration * UP_RING : duration;

    ordered.forEach((midi, i) => {
      this.playMidi(midi, ring, start + i * gap);
    });
  }

  /**
   * The chuck: strings crossed with the fretting hand laid across them.
   *
   * Pitchless on purpose. Filtered noise rather than a damped chord, because a
   * damped chord still has a chord in it and this does not — it is the sound
   * of the pick, and it is what makes a pattern feel like it has a backbeat.
   */
  public playMuted(time?: number) {
    this.init();
    if (!this.ctx || !this.masterGain) return;
    const at = time !== undefined ? time : this.ctx.currentTime;

    const seconds = 0.09;
    const buffer = this.ctx.createBuffer(1, Math.ceil(this.ctx.sampleRate * seconds), this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;

    // Wound strings under a resting hand: a band low enough to have body,
    // narrow enough to have no note.
    const band = this.ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.setValueAtTime(1800, at);
    band.Q.setValueAtTime(1.1, at);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(0.34, at + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + seconds);

    source.connect(band);
    band.connect(gain);
    gain.connect(this.masterGain);
    source.start(at);
    source.stop(at + seconds + 0.02);
  }

  public playChord(midis: number[], duration: number = 2.0, time?: number) {
    const playTime = time !== undefined ? time : this.getCurrentTime();
    midis.forEach((midi) => {
      this.playMidi(midi, duration, playTime);
    });
  }

  // Core sound synthesis: Acoustic Guitar physical modeling (Additive Overtones + Wood Pluck Noise)
  public playNote(frequency: number, duration: number = 2.0, time?: number, midi?: number) {
    this.init();
    if (!this.ctx || !this.masterGain) return;

    const now = time !== undefined ? time : this.ctx.currentTime;

    // Scale duration based on pitch (high notes decay faster, low notes sustain longer)
    const pitchScale = Math.pow(150 / frequency, 0.4);
    const finalDuration = Math.max(0.4, Math.min(4.0, duration * pitchScale));

    const pluckGain = this.ctx.createGain();
    pluckGain.connect(this.masterGain);

    // Only notes addressed by MIDI can be held later, which is every note an
    // instrument surface plays. Scheduled-in-advance notes are left alone.
    const voice: Voice | null =
      midi !== undefined ? { midi, parts: [], sustained: false } : null;

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
      voice?.parts.push({ osc, gain: oscGain, peak: gainRatio });
    });

    if (voice && midi !== undefined) {
      const id = this.nextVoiceId++;
      this.voices.set(id, voice);
      this.latestByMidi.set(midi, id);
      // A note nobody held is forgotten once it has finished decaying
      window.setTimeout(() => {
        if (!this.voices.get(id)?.sustained) {
          this.voices.delete(id);
          if (this.latestByMidi.get(midi) === id) this.latestByMidi.delete(midi);
        }
      }, (finalDuration + 0.5) * 1000);
    }

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
