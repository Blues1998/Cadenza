import React, { useEffect, useRef, useState } from 'react';

interface PulseGrooveStageProps {
  beatsPerBar: number;
  subdivision: number;
  bpm: number;
  swing: number; // 0 to 0.75
  onSwingChange: (swing: number) => void;
  at: () => number | null;
  isPlaying: boolean;
}

/**
 * Pulse & Groove Stage
 * Visualizes rhythm through organic expanding pulse waves, accent blooms on beat 1,
 * and a tactile swing dial to feel the difference between straight and swung shuffle groove.
 */
export const PulseGrooveStage: React.FC<PulseGrooveStageProps> = ({
  beatsPerBar,
  subdivision,
  bpm,
  swing,
  onSwingChange,
  at,
  isPlaying
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [currentBeatDisplay, setCurrentBeatDisplay] = useState<number>(1);
  const [isAccent, setIsAccent] = useState<boolean>(false);
  const lastBeatRef = useRef<number>(-1);

  // Animation loop driving the canvas concentric ripples
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    interface Ripple {
      x: number;
      y: number;
      radius: number;
      maxRadius: number;
      opacity: number;
      isAccent: boolean;
      color: string;
    }

    const ripples: Ripple[] = [];
    let rafId = 0;

    const render = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const cx = w / 2;
      const cy = h / 2 - 12;

      // Check current beat from audio clock
      const beatPos = at();
      if (beatPos !== null && isPlaying) {
        const currentIntBeat = Math.floor(beatPos);
        if (currentIntBeat !== lastBeatRef.current) {
          lastBeatRef.current = currentIntBeat;
          const beatInBar = ((currentIntBeat % beatsPerBar) + beatsPerBar) % beatsPerBar + 1;
          const accented = beatInBar === 1;

          setCurrentBeatDisplay(beatInBar);
          setIsAccent(accented);

          // Spawn new concentric ripple
          ripples.push({
            x: cx,
            y: cy,
            radius: 34,
            maxRadius: Math.min(w, h) * 0.58,
            opacity: accented ? 0.95 : 0.65,
            isAccent: accented,
            color: accented ? '#f59e0b' : '#38bdf8'
          });
        }
      } else if (!isPlaying) {
        lastBeatRef.current = -1;
      }

      // Draw active ripples
      for (let i = ripples.length - 1; i >= 0; i--) {
        const r = ripples[i];
        r.radius += r.isAccent ? 3.2 : 2.4;
        r.opacity *= 0.94;

        if (r.opacity < 0.02 || r.radius > r.maxRadius) {
          ripples.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
        ctx.strokeStyle = r.color;
        ctx.globalAlpha = r.opacity;
        ctx.lineWidth = r.isAccent ? 3.5 : 2;
        ctx.shadowColor = r.color;
        ctx.shadowBlur = r.isAccent ? 16 : 8;
        ctx.stroke();
        ctx.restore();
      }

      // Draw Center Pulse Hub
      ctx.save();
      const hubRadius = 32;
      const hubGrad = ctx.createRadialGradient(cx, cy, 5, cx, cy, hubRadius);
      hubGrad.addColorStop(0, isAccent && isPlaying ? 'rgba(245, 158, 11, 0.45)' : 'rgba(56, 189, 248, 0.25)');
      hubGrad.addColorStop(1, 'rgba(15, 23, 42, 0.8)');

      ctx.beginPath();
      ctx.arc(cx, cy, hubRadius, 0, Math.PI * 2);
      ctx.fillStyle = hubGrad;
      ctx.fill();

      ctx.strokeStyle = isAccent && isPlaying ? '#f59e0b' : isPlaying ? '#38bdf8' : '#475569';
      ctx.lineWidth = isAccent && isPlaying ? 3 : 2;
      ctx.shadowColor = isAccent ? '#f59e0b' : '#38bdf8';
      ctx.shadowBlur = isPlaying ? 12 : 0;
      ctx.stroke();
      ctx.restore();

      // Draw Bouncing ball / Pip indicator along bottom track
      const trackY = h - 26;
      const trackWidth = w * 0.78;
      const trackLeft = (w - trackWidth) / 2;

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(trackLeft, trackY);
      ctx.lineTo(trackLeft + trackWidth, trackY);
      ctx.stroke();

      // Draw beat anchors and subdivision ticks along track
      if (subdivision > 1) {
        const totalSubTicks = (beatsPerBar - 1) * subdivision;
        for (let s = 0; s <= totalSubTicks; s++) {
          if (s % subdivision !== 0) {
            const sx = trackLeft + (s / Math.max(1, totalSubTicks)) * trackWidth;
            ctx.beginPath();
            ctx.arc(sx, trackY, 2, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
            ctx.fill();
          }
        }
      }

      for (let b = 0; b < beatsPerBar; b++) {
        const bx = trackLeft + (b / Math.max(1, beatsPerBar - 1)) * trackWidth;
        const isCurrent = isPlaying && currentBeatDisplay === b + 1;

        ctx.beginPath();
        ctx.arc(bx, trackY, b === 0 ? 6 : 4.5, 0, Math.PI * 2);
        ctx.fillStyle = isCurrent ? (b === 0 ? '#f59e0b' : '#38bdf8') : 'rgba(255, 255, 255, 0.2)';
        ctx.fill();
        if (isCurrent) {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }

      // Draw continuous bouncing ball if playing
      if (isPlaying && beatPos !== null) {
        const continuousBeat = ((beatPos % beatsPerBar) + beatsPerBar) % beatsPerBar;
        const ballX = trackLeft + (continuousBeat / Math.max(1, beatsPerBar - 1)) * trackWidth;
        // Parabolic bounce curve between subdivisions/beats
        const subFrac = (continuousBeat * subdivision) % 1;
        const bounceHeight = 18 * (1 - 4 * Math.pow(subFrac - 0.5, 2));
        const ballY = trackY - Math.max(0, bounceHeight);

        ctx.save();
        ctx.beginPath();
        ctx.arc(ballX, ballY, 6.5, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.restore();
      }

      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafId);
  }, [at, beatsPerBar, subdivision, isAccent, isPlaying, currentBeatDisplay]);

  return (
    <div className="pulse-groove-container">
      {/* Visual Pulse Orb & Concentric Ripples Stage */}
      <div className="pulse-canvas-wrapper">
        <canvas ref={canvasRef} className="pulse-stage-canvas" />
        <div className="pulse-center-readout" aria-hidden="true">
          <span className={`pulse-beat-num readout${isAccent && isPlaying ? ' is-accent' : ''}`}>
            {isPlaying ? currentBeatDisplay : '▶'}
          </span>
          <span className="pulse-beat-sub">
            {isPlaying ? (isAccent ? 'ONE (DOWNBEAT)' : `Beat ${currentBeatDisplay}`) : `${bpm} BPM`}
          </span>
        </div>
      </div>

      {/* Rhythmic Feel: Straight vs Swing Controller */}
      <div className="groove-feel-controller">
        <div className="groove-feel-header">
          <span className="field-label">Rhythmic Feel</span>
          <span className="groove-feel-badge readout">
            {swing === 0
              ? 'Straight 1:1 (Even clock)'
              : swing < 0.4
              ? 'Light Shuffle'
              : swing <= 0.67
              ? 'Blues / Jazz Triplet Shuffle'
              : 'Heavy Dotted Swing'}
          </span>
        </div>

        <div className="groove-slider-row">
          <span className="groove-tag">Straight</span>
          <input
            type="range"
            className="groove-swing-slider"
            min={0}
            max={0.75}
            step={0.01}
            value={swing}
            onChange={e => onSwingChange(Number(e.target.value))}
            aria-label="Swing feel ratio"
          />
          <span className="groove-tag">Swung</span>

          <button
            type="button"
            className={`btn chip-btn${swing === 0 ? ' is-active' : ''}`}
            onClick={() => onSwingChange(0)}
            title="Set even straight meter"
          >
            Straight
          </button>
          <button
            type="button"
            className={`btn chip-btn${Math.abs(swing - 0.67) < 0.05 ? ' is-active' : ''}`}
            onClick={() => onSwingChange(0.67)}
            title="Set classic 2:1 triplet shuffle swing"
          >
            Triplet Swing
          </button>
        </div>
      </div>
    </div>
  );
};
export default PulseGrooveStage;
