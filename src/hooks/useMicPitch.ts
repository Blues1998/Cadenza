import { useState, useRef, useCallback, useEffect } from 'react';
import { detectPitch, PitchStabilizer } from '../utils/pitch';
import type { PitchResult } from '../utils/pitch';

// Shared microphone + pitch detection pipeline (getUserMedia -> AnalyserNode
// -> YIN detector -> stabilizer), polled once per animation frame.
// Used by the Tuner lab and the Play Challenges lab.
export interface MicPitch {
  pitch: PitchResult | null;
  isActive: boolean;
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
}

export function useMicPitch(): MicPitch {
  const [pitch, setPitch] = useState<PitchResult | null>(null);
  const [isActive, setIsActive] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameId = useRef<number | null>(null);
  const bufferRef = useRef<Float32Array | null>(null);
  const stabilizerRef = useRef<PitchStabilizer>(new PitchStabilizer());

  const stop = useCallback(() => {
    setIsActive(false);

    if (animationFrameId.current !== null) {
      cancelAnimationFrame(animationFrameId.current);
      animationFrameId.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    sourceRef.current = null;
    analyserRef.current = null;
    stabilizerRef.current.reset();
    setPitch(null);
  }, []);

  const start = useCallback(async () => {
    try {
      setError(null);
      // Raw signal: processing like echo cancellation distorts pitched input
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      });
      streamRef.current = stream;

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContextClass();
      audioContextRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      sourceRef.current = source;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048; // high FFT size for low-frequency resolution
      analyserRef.current = analyser;
      source.connect(analyser);

      const buffer = new Float32Array(analyser.fftSize);
      bufferRef.current = buffer;
      stabilizerRef.current.reset();

      const sampleRate = ctx.sampleRate;
      const updatePitch = () => {
        analyser.getFloatTimeDomainData(buffer as any);
        const raw = detectPitch(buffer, sampleRate);
        // Stabilize: hysteresis on note changes + smoothing, so the reading
        // doesn't flicker on every animation frame
        setPitch(stabilizerRef.current.update(raw));
        animationFrameId.current = requestAnimationFrame(updatePitch);
      };
      animationFrameId.current = requestAnimationFrame(updatePitch);

      setIsActive(true);
    } catch (err) {
      console.error('Microphone initialization failed:', err);
      setError('Could not access the microphone. Please check system permissions.');
      stop();
    }
  }, [stop]);

  // Release the mic and audio context when the owning component unmounts
  useEffect(() => stop, [stop]);

  return { pitch, isActive, error, start, stop };
}
