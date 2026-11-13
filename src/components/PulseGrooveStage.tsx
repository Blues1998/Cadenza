import React, { useEffect, useRef, useState } from 'react';
import { SHUFFLE, SWING_MAX, swingName, swingOffbeat } from '../utils/swing';
import { frameGate } from '../utils/frames';

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
// What each feel sounds like, in the way people count it out loud.
const FEEL_SAID: Record<string, string> = {
  Straight: 'Even eighths: da-da da-da',
  'Light swing': 'A slight lilt on the off-beat',
  Shuffle: 'Long-short: daa-da daa-da',
  'Heavy swing': 'Very long-short: daaa-d daaa-d'
};

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
  // The loop reads these rather than the state, so it is not torn down and
  // rebuilt on every beat, which also threw away the ripples it was drawing.
  const beatRef = useRef(1);
  const swingRef = useRef(swing);
  swingRef.current = swing;
  const accentRef = useRef(false);

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

    // Theme colours, read from the page so the stage follows light and dark.
    const css = getComputedStyle(canvas);
    const tok = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
    const alpha = (hex: string, a: number) => {
      const h = hex.replace('#', '');
      const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h.slice(0, 6), 16);
      return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
    };

    const due = frameGate();
    const render = () => {
      if (!due()) { rafId = requestAnimationFrame(render); return; }
      // Read every frame (the style object is live), so a theme switch repaints at once.
      const ACC = tok('--primary', '#FF6A2A');
      const BEAT = tok('--secondary', '#C8CCD2');
      const BG = tok('--surface-1', '#17191C');
      const LINE = tok('--surface-3', '#24272C');
      const TEXT = tok('--text-primary', '#F1F0EC');
      const MUTED = tok('--text-muted', '#85898F');
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

          beatRef.current = beatInBar;
          accentRef.current = accented;
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
            color: accented ? ACC : BEAT
          });
        }
      } else if (!isPlaying) {
        lastBeatRef.current = -1;
      }

      const isAccent = accentRef.current;
      const currentBeatDisplay = beatRef.current;

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
      hubGrad.addColorStop(0, isAccent && isPlaying ? alpha(ACC, 0.45) : alpha(BEAT, 0.25));
      hubGrad.addColorStop(1, alpha(BG, 0.9));

      ctx.beginPath();
      ctx.arc(cx, cy, hubRadius, 0, Math.PI * 2);
      ctx.fillStyle = hubGrad;
      ctx.fill();

      ctx.strokeStyle = isAccent && isPlaying ? ACC : isPlaying ? BEAT : LINE;
      ctx.lineWidth = isAccent && isPlaying ? 2.5 : 1.5;
      ctx.shadowColor = isAccent && isPlaying ? ACC : BEAT;
      ctx.shadowBlur = isPlaying ? 10 : 0;
      ctx.stroke();

      // Number in center hub
      ctx.fillStyle = isAccent && isPlaying ? ACC : isPlaying ? TEXT : MUTED;
      ctx.font = "bold 18px 'JetBrains Mono', monospace";
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // Idle, the hub shows where the count will start rather than a dash.
      ctx.fillText(isPlaying ? String(currentBeatDisplay) : '1', cx, cy + 1);
      ctx.restore();

      // Draw Track along bottom for bouncing ball
      const trackY = VH - 22;
      const trackLeft = 45;
      const trackWidth = VW - 90;

      ctx.strokeStyle = alpha(TEXT, 0.08);
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
            // With two clicks a beat the off-beat sits where the swing puts it,
            // so the dots show the difference between straight and shuffle.
            const at = subdivision === 2
              ? Math.floor(s / 2) + swingOffbeat(swingRef.current)
              : s / subdivision;
            const sx = trackLeft + (at / Math.max(1, beatsPerBar - 1)) * trackWidth;
            ctx.beginPath();
            ctx.arc(sx, trackY, 1.5, 0, Math.PI * 2);
            ctx.fillStyle = alpha(TEXT, 0.15);
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
        ctx.fillStyle = isCurrent ? (b === 0 ? ACC : BEAT) : alpha(TEXT, 0.25);
        ctx.fill();
        if (isCurrent) {
          ctx.strokeStyle = TEXT;
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
        ctx.fillStyle = TEXT;
        ctx.shadowColor = BEAT;
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.restore();
      }

      // Stopped and still: the frame on screen is the frame there would be, so
      // stop asking for more. It was drawing sixty identical frames a second
      // for as long as the page was open.
      rafId = isPlaying || ripples.length > 0 ? requestAnimationFrame(render) : 0;
    };

    rafId = requestAnimationFrame(render);
    // Asleep, a theme switch still has to repaint the stage once.
    const themeWatch = new MutationObserver(() => { if (!rafId) rafId = requestAnimationFrame(render); });
    themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => { cancelAnimationFrame(rafId); themeWatch.disconnect(); };
  // swing too: asleep, the stage still has to redraw its dots when it moves.
  }, [at, beatsPerBar, subdivision, isPlaying, swing]);

  return (
    <div className={`pulse-groove-stage${isAccent && isPlaying ? ' is-accent-bar' : ''}`}>
      {/* Top Status Strip */}
      <div className="pulse-groove-strip">
        {isPlaying ? (
          <>
            <div className="pulse-groove-readout">
              <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Beat
              </span>
              <span className={`beat-number${isAccent ? ' is-accent' : ''}`}>{currentBeatDisplay}</span>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                / {beatsPerBar}
              </span>
            </div>
            <span className={`pulse-groove-accent-chip${isAccent ? ' is-active' : ''}`}>
              {isAccent ? 'Downbeat' : `Beat ${currentBeatDisplay}`}
            </span>
          </>
        ) : (
          // Before Start: what is about to happen, not a dash and a "Ready" pill.
          <p className="pulse-groove-idle">
            {beatsPerBar} beats a bar at {bpm} bpm{subdivision > 1 ? `, ${subdivision} clicks a beat` : ''}
          </p>
        )}
      </div>

      {/* Fixed 400x180 Retina Canvas Stage */}
      <div style={{ position: 'relative', width: '100%', height: '180px', overflow: 'hidden', borderRadius: '8px', background: 'var(--surface-1)' }}>
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
          <span className="swing-title">Feel</span>
          <span className="swing-feel-tag">{swingName(swing)}</span>
        </div>

        <div className="swing-slider-wrap">
          <input
            type="range"
            className="swing-range-input"
            min={0}
            max={SWING_MAX}
            step={0.01}
            value={swing}
            onChange={e => onSwingChange(Number(e.target.value))}
            aria-label="Swing feel ratio"
          />
          <span className="swing-percent readout">
            {Math.round((swing / SWING_MAX) * 100)}%
          </span>
        </div>

        <p className="swing-said">{FEEL_SAID[swingName(swing)]}</p>

        <div style={{ display: 'flex', gap: '0.35rem' }}>
          <button
            type="button"
            className={`btn ramp-btn${swing === 0 ? ' is-active' : ''}`}
            onClick={() => onSwingChange(0)}
            title="Even eighths"
          >
            Straight
          </button>
          <button
            type="button"
            className={`btn ramp-btn${Math.abs(swing - SHUFFLE) < 0.05 ? ' is-active' : ''}`}
            onClick={() => onSwingChange(SHUFFLE)}
            title="Long-short, the triplet feel"
          >
            Shuffle
          </button>
        </div>
      </div>
    </div>
  );
};

export default PulseGrooveStage;
