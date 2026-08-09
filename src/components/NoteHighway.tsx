import React, { useEffect, useRef } from 'react';
import { audio } from '../utils/audio';
import type { JudgedEvent } from '../hooks/useSongChart';

// Fixed palette, independent of the app theme — this canvas is a "stage"
// surface (same rule as Sound Physics' waveforms and Rhythm Lab's timing
// graph) that stays dark regardless of light/dark mode.
const COLORS = {
  bg: '#0f1219',
  grid: 'rgba(255,255,255,0.06)',
  hitLine: 'rgba(255,255,255,0.35)',
  upcoming: '#8b93a7',
  upcomingFill: 'rgba(139,147,167,0.15)',
  perfect: '#10b981',
  good: '#00f0ff',
  imprecise: '#f59e0b',
  miss: '#ef4444',
  text: '#0b0c10',
};

const WINDOW_AHEAD_S = 2.5; // seconds of upcoming notes visible
const WINDOW_BEHIND_S = 0.4; // how long a resolved note lingers past the hit line
const HIT_X = 64;

const colorFor = (e: JudgedEvent): string => {
  if (e.rating === 'perfect') return COLORS.perfect;
  if (e.rating === 'good') return COLORS.good;
  if (e.rating === 'imprecise') return COLORS.imprecise;
  if (e.rating === 'miss') return COLORS.miss;
  return COLORS.upcoming;
};

interface NoteHighwayProps {
  events: JudgedEvent[];
  minMidi: number;
  maxMidi: number;
  keyLabelFor: (event: JudgedEvent) => string;
}

export const NoteHighway: React.FC<NoteHighwayProps> = ({ events, minMidi, maxMidi, keyLabelFor }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const eventsRef = useRef(events);
  eventsRef.current = events;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let rafId = 0;

    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = COLORS.bg;
      ctx.fillRect(0, 0, w, h);

      const now = audio.getCurrentTime();
      const pxPerSec = (w - HIT_X) / WINDOW_AHEAD_S;
      const xFor = (t: number) => HIT_X + (t - now) * pxPerSec;

      // Faint lane grid every half second
      ctx.strokeStyle = COLORS.grid;
      ctx.lineWidth = 1;
      for (let dt = 0; dt <= WINDOW_AHEAD_S; dt += 0.5) {
        const x = xFor(now + dt);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }

      // Hit line
      ctx.strokeStyle = COLORS.hitLine;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(HIT_X, 0);
      ctx.lineTo(HIT_X, h);
      ctx.stroke();

      const midiSpan = Math.max(1, maxMidi - minMidi);
      const yForMidi = (midi: number) => h - 24 - ((midi - minMidi) / midiSpan) * (h - 48);

      for (const e of eventsRef.current) {
        if (e.audioTime < now - WINDOW_BEHIND_S || e.audioTime > now + WINDOW_AHEAD_S) continue;
        const x = xFor(e.audioTime);
        const color = colorFor(e);
        const label = keyLabelFor(e);

        if (e.kind === 'piano') {
          const y = yForMidi(e.midi);
          const r = 15;
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fillStyle = e.rating ? color : COLORS.upcomingFill;
          ctx.fill();
          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.fillStyle = e.rating ? COLORS.text : color;
          ctx.font = 'bold 11px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(label, x, y + 1);
        } else {
          const badgeW = 46;
          const badgeH = h - 20;
          const y = 10;
          ctx.beginPath();
          const rx = x - badgeW / 2;
          const radius = 8;
          ctx.moveTo(rx + radius, y);
          ctx.arcTo(rx + badgeW, y, rx + badgeW, y + badgeH, radius);
          ctx.arcTo(rx + badgeW, y + badgeH, rx, y + badgeH, radius);
          ctx.arcTo(rx, y + badgeH, rx, y, radius);
          ctx.arcTo(rx, y, rx + badgeW, y, radius);
          ctx.closePath();
          ctx.fillStyle = e.rating ? color : COLORS.upcomingFill;
          ctx.fill();
          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.fillStyle = e.rating ? COLORS.text : color;
          ctx.font = 'bold 13px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`${label} ${e.direction === 'down' ? '↓' : '↑'}`, x, y + badgeH / 2 + 1);
        }
      }

      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, [minMidi, maxMidi, keyLabelFor]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '160px', display: 'block', borderRadius: '10px' }}
    />
  );
};
export default NoteHighway;
