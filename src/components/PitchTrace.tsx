import React, { useEffect, useRef } from 'react';
import { labelFor, type Notation, type NoteLabel } from '../utils/voice';

// A voice drawn over time.
//
// A needle shows one instant, and for a voice the instant is the least useful
// part: what a singer needs to see is the slide into a note, the vibrato on
// it, the sag at the end of a phrase. So this scrolls the last few seconds of
// pitch across lanes, one per semitone, the way a singing teacher would sketch
// it on a whiteboard.
//
// Drawn on a canvas from a buffer kept in a ref. The pitch arrives as a prop
// on every animation frame; pushing it into React state as a growing array
// would re-render the whole lab sixty times a second for nothing.

interface PitchTraceProps {
  /** The current pitch as a continuous MIDI number (60.5 = a quarter tone above C4), or null when silent. */
  pitch: number | null;
  notation: Notation;
  sa: number;
  /** A note to aim for, drawn as a band. */
  target?: number | null;
  /** Half-width of the target band, in cents. */
  bandCents?: number;
  /** Seconds of history across the width. */
  seconds?: number;
  /** Pixels, or 'fill' to take the parent's whole box. */
  height?: number | 'fill';
}


/** Degrees of the major scale from the tonic: the white keys from C, the shuddha swaras from Sa. */
const NATURAL = new Set([0, 2, 4, 5, 7, 9, 11]);

/** A lane label with the same marks the big readout uses, drawn by hand. */
function drawLabel(ctx: CanvasRenderingContext2D, label: NoteLabel, x: number, y: number) {
  ctx.fillText(label.text, x, y);
  const w = ctx.measureText(label.text).width;
  ctx.strokeStyle = ctx.fillStyle as string;
  ctx.lineWidth = 1;
  if (label.komal || label.tivra) {
    const ly = label.komal ? y + 7 : y - 7;
    ctx.beginPath();
    ctx.moveTo(x, ly);
    ctx.lineTo(x + w, ly);
    ctx.stroke();
  }
  for (let i = 0; i < Math.abs(label.octave); i++) {
    ctx.beginPath();
    ctx.arc(x + w + 4 + i * 4, label.octave > 0 ? y - 5 : y + 5, 1.3, 0, Math.PI * 2);
    ctx.fill();
  }
}

export const PitchTrace: React.FC<PitchTraceProps> = ({
  pitch, notation, sa, target = null, bandCents = 30, seconds = 8, height = 240
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const points = useRef<{ t: number; m: number | null }[]>([]);
  // The window's centre, eased toward the singing so the lanes don't lurch.
  const centre = useRef<number | null>(null);
  const props = useRef({ notation, sa, target, bandCents, seconds });
  props.current = { notation, sa, target, bandCents, seconds };

  useEffect(() => {
    points.current.push({ t: performance.now(), m: pitch });
  }, [pitch]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let raf = 0;

    const draw = () => {
      raf = requestAnimationFrame(draw);
      const { notation, sa, target, bandCents, seconds } = props.current;
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const css = getComputedStyle(canvas);
      const color = (name: string) => css.getPropertyValue(name).trim();

      const now = performance.now();
      const horizon = now - seconds * 1000;
      while (points.current.length > 0 && points.current[0].t < horizon - 500) points.current.shift();

      // Where to look: the target if there is one, otherwise the recent voice.
      const voiced = points.current.filter(p => p.m !== null && p.t > now - 2500).map(p => p.m as number);
      const aim = target ?? (voiced.length ? voiced[Math.floor(voiced.length / 2)] : centre.current ?? sa + 7);
      centre.current = centre.current === null ? aim : centre.current + (aim - centre.current) * 0.06;
      // Semitones visible: about 30px a lane, never less than an octave.
      const SPAN = Math.max(13, Math.min(25, h / 30));
      const top = centre.current + SPAN / 2;
      const y = (m: number) => ((top - m) / SPAN) * h;
      const LABEL_W = 44;
      const x = (t: number) => LABEL_W + ((t - horizon) / (seconds * 1000)) * (w - LABEL_W);

      // Lanes, one per semitone. Sa and Pa (or C) carry more weight: they are
      // the notes a singer orients by.
      ctx.font = `500 11px ${css.fontFamily}`;
      ctx.textBaseline = 'middle';
      for (let m = Math.floor(top - SPAN); m <= Math.ceil(top); m++) {
        const yy = y(m);
        if (yy < -10 || yy > h + 10) continue;
        // Three weights: sharps and flats (komal, tivra) faint, natural notes
        // (shuddha swaras) bold, and each octave's C or Sa boldest.
        const degree = (((m - (notation === 'sargam' ? sa : 0)) % 12) + 12) % 12;
        const octave = degree === 0;
        const natural = NATURAL.has(degree);
        ctx.strokeStyle = color(octave ? '--text-muted' : '--panel-border-hover');
        ctx.globalAlpha = octave ? 0.9 : natural ? 0.85 : 0.35;
        ctx.lineWidth = octave ? 2.5 : natural ? 1.5 : 1;
        ctx.beginPath();
        ctx.moveTo(LABEL_W, yy);
        ctx.lineTo(w, yy);
        ctx.stroke();
        ctx.globalAlpha = natural ? 1 : 0.55;
        ctx.font = `${octave ? 700 : natural ? 600 : 400} 11px ${css.fontFamily}`;
        ctx.fillStyle = color(octave ? '--text-primary' : natural ? '--text-secondary' : '--text-muted');
        drawLabel(ctx, labelFor(m, notation, sa), 4, yy);
        ctx.globalAlpha = 1;
      }

      if (target !== null) {
        const band = bandCents / 100;
        ctx.fillStyle = color('--success-glow');
        ctx.fillRect(LABEL_W, y(target + band), w - LABEL_W, y(target - band) - y(target + band));
        ctx.strokeStyle = color('--success');
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(LABEL_W, y(target));
        ctx.lineTo(w, y(target));
        ctx.stroke();
      }

      // The voice. Broken wherever the singing stopped, so a breath is a gap
      // rather than a line drawn across it.
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const pts = points.current;
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1];
        const b = pts[i];
        // A jump of more than a couple of semitones between two frames is the
        // detector catching the start of a note, not the voice travelling.
        if (a.m === null || b.m === null || b.t - a.t > 150 || Math.abs(b.m - a.m) > 2) continue;
        const inBand = target !== null && Math.abs(b.m - target) * 100 <= bandCents;
        ctx.strokeStyle = color(inBand ? '--success' : '--primary');
        ctx.beginPath();
        ctx.moveTo(x(a.t), y(a.m));
        ctx.lineTo(x(b.t), y(b.m));
        ctx.stroke();
      }

      // The live end: a dot where the voice is right now.
      const last = pts[pts.length - 1];
      if (last && last.m !== null && now - last.t < 200) {
        ctx.fillStyle = color('--primary');
        ctx.beginPath();
        ctx.arc(x(now), y(last.m), 5, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={canvasRef} className="pitchtrace" style={{ height: height === 'fill' ? '100%' : height }} aria-label="Your pitch over the last few seconds" role="img" />;
};

export default PitchTrace;
