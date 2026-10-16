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
 * bouncing subdivision ball, and a tactile swing dial.
 *
 * Sized with a fixed internal coordinate system (400x180 at 2x DPR) to ensure
 * rock-solid GPU rendering across all browsers without dynamic canvas resizing loops.
 */
export const PulseGrooveStage: React.FC<PulseGrooveStageProps> = ({
  beatsPerBar,
  subdivision,
  bpm: _bpm,
  swing,
  onSwingChange,
  at,
  isPlaying
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [currentBeatDisplay, setCurrentBeatDisplay] = useState<number>(1);
  const [isAccent, setIsAccent] = useState<boolean>(false);
  const lastBeatRef = useRef<number>(-1);

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

    // Fixed virtual canvas coordinate system
    const VW = 400;
    const VH = 180;
    const cx = VW / 2;
    const cy = VH / 2 - 14;

    const render = () => {
      // 2x Retina scale onto fixed 800x360 buffer
      ctx.setTransform(2, 0, 0, 2, 0, 0);
      ctx.clearRect(0, 0, VW, VH);

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

          // Spawn new expanding pulse ripple
          ripples.push({
            x: cx,
            y: cy,
            radius: 28,
            maxRadius: 110,
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
        r.radius += r.isAccent ? 2.8 : 2.2;
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
        ctx.lineWidth = r.isAccent ? 3 : 1.8;
        ctx.shadowColor = r.color;
        ctx.shadowBlur = r.isAccent ? 14 : 7;
        ctx.stroke();
        ctx.restore();
      }

      // Draw Center Pulse Hub
      ctx.save();
      const hubRadius = 26;
      const hubGrad = ctx.createRadialGradient(cx, cy, 4, cx, cy, hubRadius);
      hubGrad.addColorStop(0, isAccent && isPlaying ? 'rgba(245, 158, 11, 0.45)' : 'rgba(56, 189, 248, 0.25)');
      hubGrad.addColorStop(1, 'rgba(15, 23, 42, 0.9)');

      ctx.beginPath();
      ctx.arc(cx, cy, hubRadius, 0, Math.PI * 2);
      ctx.fillStyle = hubGrad;
      ctx.fill();

      ctx.strokeStyle = isAccent && isPlaying ? '#f59e0b' : isPlaying ? '#38bdf8' : '#334155';
      ctx.lineWidth = isAccent && isPlaying ? 2.5 : 1.5;
      ctx.shadowColor = isAccent && isPlaying ? '#f59e0b' : '#38bdf8';
      ctx.shadowBlur = isPlaying ? 10 : 0;
      ctx.stroke();

      // Number in center hub
      ctx.fillStyle = isAccent && isPlaying ? '#f59e0b' : isPlaying ? '#f8fafc' : '#64748b';
      ctx.font = "bold 18px 'JetBrains Mono', monospace";
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(isPlaying ? String(currentBeatDisplay) : '—', cx, cy + 1);
      ctx.restore();

      // Draw Track along bottom for bouncing ball
      const trackY = VH - 22;
      const trackLeft = 45;
      const trackWidth = VW - 90;

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(trackLeft, trackY);
      ctx.lineTo(trackLeft + trackWidth, trackY);
      ctx.stroke();

      // Subdivision pip dots
      if (subdivision > 1) {
        const totalSubTicks = (beatsPerBar - 1) * subdivision;
        for (let s = 0; s <= totalSubTicks; s++) {
          if (s % subdivision !== 0) {
            const sx = trackLeft + (s / Math.max(1, totalSubTicks)) * trackWidth;
            ctx.beginPath();
            ctx.arc(sx, trackY, 1.5, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
            ctx.fill();
          }
        }
      }

      // Beat marker pips
      for (let b = 0; b < beatsPerBar; b++) {
        const bx = trackLeft + (b / Math.max(1, beatsPerBar - 1)) * trackWidth;
        const isCurrent = isPlaying && currentBeatDisplay === b + 1;

        ctx.beginPath();
        ctx.arc(bx, trackY, b === 0 ? 5 : 3.5, 0, Math.PI * 2);
        ctx.fillStyle = isCurrent ? (b === 0 ? '#f59e0b' : '#38bdf8') : 'rgba(255, 255, 255, 0.25)';
        ctx.fill();
        if (isCurrent) {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }
      }

      // Continuous bouncing ball when playing
      if (isPlaying && beatPos !== null) {
        const continuousBeat = ((beatPos % beatsPerBar) + beatsPerBar) % beatsPerBar;
        const ballX = trackLeft + (continuousBeat / Math.max(1, beatsPerBar - 1)) * trackWidth;
        const subFrac = (continuousBeat * subdivision) % 1;
        const bounceHeight = 16 * (1 - 4 * Math.pow(subFrac - 0.5, 2));
        const ballY = trackY - Math.max(0, bounceHeight);

        ctx.save();
        ctx.beginPath();
        ctx.arc(ballX, ballY, 5.5, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.restore();
      }

      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafId);
  }, [at, beatsPerBar, subdivision, isAccent, isPlaying, currentBeatDisplay]);

  return (
    <div className={`pulse-groove-stage${isAccent && isPlaying ? ' is-accent-bar' : ''}`}>
      {/* Top Status Strip */}
      <div className="pulse-groove-strip">
        <div className="pulse-groove-readout">
          <span style={{ fontSize: '0.82rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Beat
          </span>
          <span className={`beat-number${isAccent && isPlaying ? ' is-accent' : ''}`}>
            {isPlaying ? currentBeatDisplay : '—'}
          </span>
          <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
            / {beatsPerBar}
          </span>
        </div>

        <span className={`pulse-groove-accent-chip${isAccent && isPlaying ? ' is-active' : ''}`}>
          {isAccent && isPlaying ? '★ DOWNBEAT' : isPlaying ? `BEAT ${currentBeatDisplay}` : 'STANDBY'}
        </span>
      </div>

      {/* Fixed 400x180 Retina Canvas Stage */}
      <div style={{ position: 'relative', width: '100%', height: '180px', overflow: 'hidden', borderRadius: '8px', background: '#090d16' }}>
        <canvas
          ref={canvasRef}
          width={800}
          height={360}
          style={{
            width: '100%',
            height: '180px',
            display: 'block',
            borderRadius: '8px',
            pointerEvents: 'none'
          }}
        />
      </div>

      {/* Rhythmic Feel: Straight vs Swing Controller */}
      <div className="swing-shuffle-control">
        <div className="swing-header-group">
          <span className="swing-title">Groove Feel</span>
          <span className="swing-feel-tag">
            {swing === 0
              ? 'Straight 1:1 (Even clock)'
              : swing < 0.4
              ? 'Light Shuffle'
              : swing <= 0.67
              ? 'Blues / Triplet Shuffle'
              : 'Heavy Dotted Swing'}
          </span>
        </div>

        <div className="swing-slider-wrap">
          <input
            type="range"
            className="swing-range-input"
            min={0}
            max={0.75}
            step={0.01}
            value={swing}
            onChange={e => onSwingChange(Number(e.target.value))}
            aria-label="Swing feel ratio"
          />
          <span className="swing-percent readout">
            {Math.round((swing / 0.75) * 100)}%
          </span>
        </div>

        <div style={{ display: 'flex', gap: '0.35rem' }}>
          <button
            type="button"
            className={`btn ramp-btn${swing === 0 ? ' is-active' : ''}`}
            onClick={() => onSwingChange(0)}
            title="Set even straight meter"
          >
            Straight
          </button>
          <button
            type="button"
            className={`btn ramp-btn${Math.abs(swing - 0.67) < 0.05 ? ' is-active' : ''}`}
            onClick={() => onSwingChange(0.67)}
            title="Set classic 2:1 triplet blues shuffle"
          >
            Shuffle
          </button>
        </div>
      </div>
    </div>
  );
};

export default PulseGrooveStage;
