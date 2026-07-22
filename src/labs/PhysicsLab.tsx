import React, { useState, useEffect, useRef, useCallback } from 'react';
import { audio } from '../utils/audio';
import { NOTE_NAMES } from '../utils/musicTheory';
import { reportProgress } from '../utils/progress';

// ---- Shared drawing helpers ----
const COLORS = {
  primary: '#00f0ff',
  secondary: '#8b5cf6',
  success: '#10b981',
  warning: '#f59e0b',
  grid: 'rgba(255,255,255,0.07)',
  faint: 'rgba(255,255,255,0.18)'
};

const setupCanvas = (canvas: HTMLCanvasElement) => {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);
  return { ctx, w, h };
};

const drawMidline = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, h / 2);
  ctx.lineTo(w, h / 2);
  ctx.stroke();
};

// Play two sustained pure sine tones together for `dur` seconds
const playDyad = (hzA: number, hzB: number, dur = 1.6) => {
  const bus = audio.getMasterBus();
  if (!bus) return;
  const { ctx, input } = bus;
  const now = ctx.currentTime;
  [hzA, hzB].forEach(hz => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(hz, now);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.14, now + 0.03);
    gain.gain.setValueAtTime(0.14, now + dur - 0.25);
    gain.gain.linearRampToValueAtTime(0.0001, now + dur);
    osc.connect(gain);
    gain.connect(input);
    osc.start(now);
    osc.stop(now + dur + 0.05);
  });
};

const BASE_HZ = 220; // A3 — comfortable reference pitch for every demo

// ============================================================
// 1. Harmonic Series Explorer (timbre = overtone recipe)
// ============================================================
const HARMONIC_PRESETS: { name: string; amps: number[] }[] = [
  { name: 'Pure Sine', amps: [1, 0, 0, 0, 0, 0] },
  { name: 'Our Guitar Synth', amps: [0.55, 0.25, 0.12, 0.06, 0.03, 0.015] },
  { name: 'Hollow (odd only)', amps: [1, 0, 0.33, 0, 0.2, 0] },
  { name: 'Bright & Buzzy', amps: [0.6, 0.5, 0.45, 0.4, 0.35, 0.3] }
];

const HarmonicExplorer: React.FC = () => {
  const [amps, setAmps] = useState<number[]>(HARMONIC_PRESETS[1].amps);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { ctx, w, h } = setupCanvas(canvas);
    ctx.clearRect(0, 0, w, h);
    drawMidline(ctx, w, h);

    const CYCLES = 2; // draw two periods of the fundamental
    const sum = (x01: number) =>
      amps.reduce((acc, a, n) => acc + a * Math.sin(2 * Math.PI * (n + 1) * CYCLES * x01), 0);

    // Normalize so the tallest peak fits the canvas
    let peak = 0.001;
    for (let i = 0; i <= 400; i++) peak = Math.max(peak, Math.abs(sum(i / 400)));
    const yFor = (v: number) => h / 2 - (v / peak) * (h / 2 - 8);

    // Faint individual harmonics
    amps.forEach((a, n) => {
      if (a <= 0.005) return;
      ctx.strokeStyle = COLORS.faint;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let px = 0; px <= w; px++) {
        const y = yFor(a * Math.sin(2 * Math.PI * (n + 1) * CYCLES * (px / w)));
        if (px === 0) ctx.moveTo(px, y); else ctx.lineTo(px, y);
      }
      ctx.stroke();
    });

    // The summed wave — what you actually hear
    ctx.strokeStyle = COLORS.primary;
    ctx.lineWidth = 2.5;
    ctx.shadowColor = 'rgba(0,240,255,0.4)';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    for (let px = 0; px <= w; px++) {
      const y = yFor(sum(px / w));
      if (px === 0) ctx.moveTo(px, y); else ctx.lineTo(px, y);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
  }, [amps]);

  const play = () => {
    const bus = audio.getMasterBus();
    if (!bus) return;
    const { ctx, input } = bus;
    // Build the exact waveform shown on the canvas via a PeriodicWave
    const real = new Float32Array(amps.length + 1);
    const imag = new Float32Array(amps.length + 1);
    amps.forEach((a, n) => { imag[n + 1] = a; });
    const osc = ctx.createOscillator();
    osc.setPeriodicWave(ctx.createPeriodicWave(real, imag));
    osc.frequency.setValueAtTime(BASE_HZ, ctx.currentTime);
    const gain = ctx.createGain();
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.3, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.8);
    osc.connect(gain);
    gain.connect(input);
    osc.start(now);
    osc.stop(now + 1.9);
    reportProgress('physics-harmonic-played');
  };

  return (
    <section className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <h3 style={{ fontSize: '1.15rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.5rem' }}>
        1 · Why instruments sound different: the harmonic series
      </h3>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
        Every musical note is not one frequency but a stack: the fundamental <em>f</em> plus overtones
        at exactly 2f, 3f, 4f… A guitar and a flute playing the same note differ only in the
        <strong style={{ color: '#fff' }}> recipe of overtone amplitudes</strong> — that recipe is what
        we call timbre. Mix your own below (faint lines = individual harmonics, bright line = their sum).
      </p>

      <canvas ref={canvasRef} style={{ width: '100%', height: '130px', background: 'rgba(0,0,0,0.25)', borderRadius: '10px' }} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '0.75rem' }}>
        {amps.map((a, n) => (
          <label key={n} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
            <span>{n + 1}f · {Math.round(BASE_HZ * (n + 1))} Hz</span>
            <input
              type="range" min={0} max={1} step={0.01} value={a}
              onChange={e => {
                const next = [...amps];
                next[n] = Number(e.target.value);
                setAmps(next);
              }}
            />
          </label>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <button onClick={play} className="btn btn-primary" style={{ padding: '0.45rem 1rem', fontSize: '0.8rem' }}>
          ▶ Hear this exact waveform
        </button>
        {HARMONIC_PRESETS.map(p => (
          <button key={p.name} onClick={() => setAmps(p.amps)} className="btn" style={{ padding: '0.4rem 0.7rem', fontSize: '0.75rem' }}>
            {p.name}
          </button>
        ))}
      </div>
      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        "Our Guitar Synth" is the literal recipe this app's guitar sound uses (see src/utils/audio.ts) —
        55% fundamental, 25% second harmonic, and so on.
      </p>
    </section>
  );
};

// ============================================================
// 2. Consonance = simple frequency ratios (+ beating)
// ============================================================
const SIMPLE_RATIOS: [number, number, string][] = [
  [1, 1, 'Unison'], [16, 15, 'Minor 2nd'], [9, 8, 'Major 2nd'], [6, 5, 'Minor 3rd'],
  [5, 4, 'Major 3rd'], [4, 3, 'Perfect 4th'], [7, 5, 'Tritone-ish'], [3, 2, 'Perfect 5th'],
  [8, 5, 'Minor 6th'], [5, 3, 'Major 6th'], [16, 9, 'Minor 7th'], [15, 8, 'Major 7th'], [2, 1, 'Octave']
];

const RatioExplorer: React.FC = () => {
  const [ratio, setRatio] = useState<number>(1.02); // start just off unison: audible beating
  const [sounding, setSounding] = useState<boolean>(false);

  const waveCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const envCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const oscBRef = useRef<OscillatorNode | null>(null);
  const oscARef = useRef<OscillatorNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);

  const f2 = BASE_HZ * ratio;

  // Closest simple ratio + distance in cents
  let closest = SIMPLE_RATIOS[0];
  let closestCents = Infinity;
  for (const r of SIMPLE_RATIOS) {
    const cents = 1200 * Math.log2(ratio / (r[0] / r[1]));
    if (Math.abs(cents) < Math.abs(closestCents)) {
      closestCents = cents;
      closest = r;
    }
  }
  const locked = Math.abs(closestCents) < 6;

  useEffect(() => {
    // Zoomed waveform (35 ms): simple ratios show a repeating combined pattern
    const wave = waveCanvasRef.current;
    if (wave) {
      const { ctx, w, h } = setupCanvas(wave);
      ctx.clearRect(0, 0, w, h);
      drawMidline(ctx, w, h);
      const T = 0.035;
      ctx.strokeStyle = locked ? COLORS.success : COLORS.primary;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      for (let px = 0; px <= w; px++) {
        const t = (px / w) * T;
        const y = (Math.sin(2 * Math.PI * BASE_HZ * t) + Math.sin(2 * Math.PI * f2 * t)) / 2;
        const yPix = h / 2 - y * (h / 2 - 6);
        if (px === 0) ctx.moveTo(px, yPix); else ctx.lineTo(px, yPix);
      }
      ctx.stroke();
    }

    // 1-second min/max envelope: beating appears as a slow amplitude wobble
    const env = envCanvasRef.current;
    if (env) {
      const { ctx, w, h } = setupCanvas(env);
      ctx.clearRect(0, 0, w, h);
      drawMidline(ctx, w, h);
      const T = 1.0;
      const SUB = 48; // samples per pixel column
      ctx.fillStyle = locked ? 'rgba(16,185,129,0.55)' : 'rgba(0,240,255,0.55)';
      for (let px = 0; px < w; px++) {
        let min = 2, max = -2;
        for (let s = 0; s < SUB; s++) {
          const t = ((px + s / SUB) / w) * T;
          const y = (Math.sin(2 * Math.PI * BASE_HZ * t) + Math.sin(2 * Math.PI * f2 * t)) / 2;
          if (y < min) min = y;
          if (y > max) max = y;
        }
        const yTop = h / 2 - max * (h / 2 - 4);
        const yBot = h / 2 - min * (h / 2 - 4);
        ctx.fillRect(px, yTop, 1, Math.max(1, yBot - yTop));
      }
    }
  }, [ratio, f2, locked]);

  const stopDuo = useCallback(() => {
    const bus = audio.getMasterBus();
    if (gainRef.current && bus) {
      gainRef.current.gain.setTargetAtTime(0.0001, bus.ctx.currentTime, 0.03);
    }
    const a = oscARef.current, b = oscBRef.current;
    if (bus) {
      const stopAt = bus.ctx.currentTime + 0.2;
      a?.stop(stopAt);
      b?.stop(stopAt);
    } else {
      a?.stop();
      b?.stop();
    }
    oscARef.current = null;
    oscBRef.current = null;
    gainRef.current = null;
    setSounding(false);
  }, []);

  const startDuo = () => {
    const bus = audio.getMasterBus();
    if (!bus) return;
    const { ctx, input } = bus;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.16, ctx.currentTime + 0.05);
    gain.connect(input);
    gainRef.current = gain;

    const mk = (hz: number) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(hz, ctx.currentTime);
      osc.connect(gain);
      osc.start();
      return osc;
    };
    oscARef.current = mk(BASE_HZ);
    oscBRef.current = mk(f2);
    setSounding(true);
  };

  // Live-update the movable oscillator while sounding
  useEffect(() => {
    const bus = audio.getMasterBus();
    if (sounding && oscBRef.current && bus) {
      oscBRef.current.frequency.setTargetAtTime(f2, bus.ctx.currentTime, 0.015);
    }
  }, [f2, sounding]);

  // Kill oscillators when leaving the lab
  useEffect(() => stopDuo, [stopDuo]);

  // Journey: locking onto a simple ratio while the tones are sounding
  useEffect(() => {
    if (locked && sounding) reportProgress('physics-ratio-locked');
  }, [locked, sounding]);

  return (
    <section className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <h3 style={{ fontSize: '1.15rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.5rem' }}>
        2 · Why some notes sound good together: simple ratios & beating
      </h3>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
        Two tones sound <strong style={{ color: '#fff' }}>consonant</strong> when their frequencies form a
        simple ratio (2:1, 3:2, 5:4…): the combined wave repeats in a short, tidy pattern. In between,
        the waves drift in and out of phase and the loudness wobbles at |f₂ − f₁| Hz — that wobble is
        <strong style={{ color: '#fff' }}> beating</strong>, the physical thing you hear as "out of tune".
        Turn the sound on and drag the slider slowly.
      </p>

      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <button onClick={sounding ? stopDuo : startDuo} className={`btn ${sounding ? 'btn-secondary' : 'btn-primary'}`} style={{ padding: '0.45rem 1rem', fontSize: '0.8rem' }}>
          {sounding ? '■ Stop Sound' : '▶ Sound On (two sine tones)'}
        </button>
        <span style={{ fontSize: '0.85rem', fontFamily: 'monospace', color: locked ? 'var(--success)' : 'var(--text-secondary)' }}>
          {BASE_HZ} Hz + {f2.toFixed(1)} Hz · ratio {ratio.toFixed(3)} ·
          {' '}nearest {closest[0]}:{closest[1]} ({closest[2]}) {closestCents >= 0 ? '+' : ''}{closestCents.toFixed(0)}¢
          {locked ? ' — locked in!' : ''}
        </span>
      </div>

      <input type="range" min={1} max={2.05} step={0.001} value={ratio} onChange={e => setRatio(Number(e.target.value))} />

      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
        {([[1.02, 'Beating (≈1:1)'], [6 / 5, 'm3 · 6:5'], [5 / 4, 'M3 · 5:4'], [4 / 3, 'P4 · 4:3'], [Math.SQRT2, 'Tritone · √2'], [3 / 2, 'P5 · 3:2'], [2, 'Octave · 2:1']] as [number, string][]).map(([r, label]) => (
          <button key={label} onClick={() => setRatio(r)} className="btn" style={{ padding: '0.35rem 0.6rem', fontSize: '0.72rem' }}>
            {label}
          </button>
        ))}
      </div>

      <div>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Combined wave, zoomed to 35 ms — simple ratios repeat neatly:</span>
        <canvas ref={waveCanvasRef} style={{ width: '100%', height: '80px', background: 'rgba(0,0,0,0.25)', borderRadius: '10px', marginTop: '0.25rem' }} />
      </div>
      <div>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Same signal over 1 full second — beating shows up as slow loudness waves:</span>
        <canvas ref={envCanvasRef} style={{ width: '100%', height: '80px', background: 'rgba(0,0,0,0.25)', borderRadius: '10px', marginTop: '0.25rem' }} />
      </div>
      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        The tritone sits at √2 ≈ 1.414 — a famously irrational spot with no tidy pattern, which is
        exactly why it sounds tense. This is also how you tune by ear: adjust until the beating stops.
      </p>
    </section>
  );
};

// ============================================================
// 3. Equal temperament: the 2^(1/12) engineering compromise
// ============================================================
const TEMPER_ROWS: { name: string; semis: number; p: number; q: number }[] = [
  { name: 'Major 2nd', semis: 2, p: 9, q: 8 },
  { name: 'Minor 3rd', semis: 3, p: 6, q: 5 },
  { name: 'Major 3rd', semis: 4, p: 5, q: 4 },
  { name: 'Perfect 4th', semis: 5, p: 4, q: 3 },
  { name: 'Perfect 5th', semis: 7, p: 3, q: 2 },
  { name: 'Major 6th', semis: 9, p: 5, q: 3 },
  { name: 'Octave', semis: 12, p: 2, q: 1 }
];

const TemperamentTable: React.FC = () => (
  <section className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
    <h3 style={{ fontSize: '1.15rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.5rem' }}>
      3 · Why 12 notes? Equal temperament is a floating-point hack
    </h3>
    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
      Pure ratios are physically perfect but mutually incompatible — an instrument tuned to pure ratios
      in C sounds sour in E. The fix (≈1600s): split the octave into 12 <em>equal</em> steps of
      2<sup>1/12</sup> ≈ 1.0595 each. Then every interval is slightly wrong in <em>every</em> key by the
      same tiny amount — a lossy compression scheme trading perfection for universality. It works because of a
      numerical coincidence: <span style={{ fontFamily: 'monospace', color: '#fff' }}>2^(7/12) = 1.4983 ≈ 3/2</span>.
      The error, measured in cents (1 semitone = 100¢):
    </p>

    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
        <thead>
          <tr style={{ color: 'var(--text-muted)', textAlign: 'left' }}>
            {['Interval', 'Pure ratio', 'Pure (¢)', '12-TET (¢)', 'Error', 'Hear the difference'].map(hd => (
              <th key={hd} style={{ padding: '0.4rem 0.6rem', borderBottom: '1px solid rgba(255,255,255,0.08)', fontWeight: 600 }}>{hd}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {TEMPER_ROWS.map(row => {
            const justCents = 1200 * Math.log2(row.p / row.q);
            const error = row.semis * 100 - justCents;
            const bad = Math.abs(error) > 10;
            return (
              <tr key={row.name} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <td style={{ padding: '0.4rem 0.6rem', fontWeight: 600 }}>{row.name}</td>
                <td style={{ padding: '0.4rem 0.6rem', fontFamily: 'monospace' }}>{row.p}:{row.q}</td>
                <td style={{ padding: '0.4rem 0.6rem', fontFamily: 'monospace' }}>{justCents.toFixed(1)}</td>
                <td style={{ padding: '0.4rem 0.6rem', fontFamily: 'monospace' }}>{row.semis * 100}</td>
                <td style={{ padding: '0.4rem 0.6rem', fontFamily: 'monospace', color: bad ? 'var(--warning)' : 'var(--success)' }}>
                  {error >= 0 ? '+' : ''}{error.toFixed(1)}¢
                </td>
                <td style={{ padding: '0.4rem 0.6rem', display: 'flex', gap: '0.35rem' }}>
                  <button onClick={() => playDyad(BASE_HZ, BASE_HZ * (row.p / row.q))} className="btn" style={{ padding: '0.25rem 0.55rem', fontSize: '0.7rem' }}>
                    Pure
                  </button>
                  <button onClick={() => playDyad(BASE_HZ, BASE_HZ * Math.pow(2, row.semis / 12))} className="btn" style={{ padding: '0.25rem 0.55rem', fontSize: '0.7rem' }}>
                    12-TET
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
      Fifths and fourths land within 2¢ — inaudible. Thirds are ~14¢ off, and you <em>can</em> hear it:
      the tempered major third beats gently where the pure 5:4 is perfectly smooth. Every piano,
      guitar fret, and this app all accept that error on purpose.
    </p>
  </section>
);

// ============================================================
// 4. The circle of fifths is (n + 7) mod 12
// ============================================================
const STEP_CHOICES = [7, 5, 4, 3, 2, 1];
const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

const ModularCircle: React.FC = () => {
  const [stepSize, setStepSize] = useState<number>(7);
  const [visited, setVisited] = useState<number[]>([0]);
  const [auto, setAuto] = useState<boolean>(false);

  const reachable = 12 / gcd(stepSize, 12);
  const complete = visited.length > 1 && visited[visited.length - 1] === visited[0];

  const step = useCallback(() => {
    if (visited.length > 1 && visited[visited.length - 1] === visited[0]) return; // cycle closed
    const next = (visited[visited.length - 1] + stepSize) % 12;
    audio.init();
    audio.playMidi(48 + next, 0.8);
    setVisited([...visited, next]);
  }, [visited, stepSize]);

  const reset = useCallback(() => {
    setVisited([0]);
    setAuto(false);
  }, []);

  useEffect(() => {
    if (!auto) return;
    if (complete) {
      setAuto(false);
      return;
    }
    const id = window.setTimeout(step, 550);
    return () => window.clearTimeout(id);
  }, [auto, visited, complete, step]);

  // Reset the walk when the step size changes
  useEffect(() => { reset(); }, [stepSize, reset]);

  // Journey: completing the full circle-of-fifths walk
  useEffect(() => {
    if (complete && stepSize === 7 && new Set(visited).size === 12) {
      reportProgress('physics-circle-completed');
    }
  }, [complete, stepSize, visited]);

  const cx = 150, cy = 150, r = 115;
  const pos = (pc: number) => {
    const ang = ((pc * 30) - 90) * Math.PI / 180;
    return { x: cx + r * Math.cos(ang), y: cy + r * Math.sin(ang) };
  };
  const uniqueVisited = new Set(visited).size;

  return (
    <section className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <h3 style={{ fontSize: '1.15rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.5rem' }}>
        4 · The circle of fifths is just (n + 7) mod 12
      </h3>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
        Arrange the 12 notes in a circle (chromatic order) and repeatedly jump up a perfect fifth —
        7 semitones. Because <span style={{ fontFamily: 'monospace', color: '#fff' }}>gcd(7, 12) = 1</span>,
        the walk visits <em>every</em> note exactly once before returning home: that's the entire reason the
        circle of fifths exists. Try other step sizes and watch composite steps get stuck in small subgroups.
      </p>

      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="300" height="300" viewBox="0 0 300 300">
          {/* chord lines of the walk */}
          {visited.slice(1).map((pc, i) => {
            const a = pos(visited[i]);
            const b = pos(pc);
            return (
              <line
                key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke={COLORS.secondary} strokeWidth="1.75" opacity={0.35 + 0.65 * ((i + 1) / Math.max(1, visited.length - 1))}
              />
            );
          })}
          {/* note nodes */}
          {NOTE_NAMES.map((name, pc) => {
            const p = pos(pc);
            const isVisited = visited.includes(pc);
            const isCurrent = visited[visited.length - 1] === pc;
            return (
              <g key={name}>
                <circle
                  cx={p.x} cy={p.y} r={isCurrent ? 17 : 14}
                  fill={isCurrent ? 'rgba(245,158,11,0.25)' : isVisited ? 'rgba(0,240,255,0.12)' : 'rgba(255,255,255,0.03)'}
                  stroke={isCurrent ? COLORS.warning : isVisited ? COLORS.primary : 'rgba(255,255,255,0.12)'}
                  strokeWidth={isCurrent ? 2 : 1}
                />
                <text x={p.x} y={p.y + 4} textAnchor="middle" fontSize="11" fontWeight={isVisited ? 700 : 400}
                  fill={isCurrent ? COLORS.warning : isVisited ? '#fff' : 'var(--text-muted)'}>
                  {name}
                </text>
              </g>
            );
          })}
          <text x={cx} y={cy - 6} textAnchor="middle" fontSize="12" fill="var(--text-secondary)">step +{stepSize}</text>
          <text x={cx} y={cy + 14} textAnchor="middle" fontSize="12" fill={uniqueVisited === 12 ? COLORS.success : 'var(--text-secondary)'}>
            {uniqueVisited} / 12 notes
          </text>
        </svg>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', minWidth: '230px', flex: 1 }}>
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
            {STEP_CHOICES.map(s => (
              <button key={s} onClick={() => setStepSize(s)} className={`btn ${stepSize === s ? 'btn-primary' : ''}`} style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem' }}>
                +{s}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button onClick={step} className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} disabled={complete}>
              Step once
            </button>
            <button onClick={() => setAuto(a => !a)} className="btn" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} disabled={complete}>
              {auto ? 'Pause' : 'Auto-walk'}
            </button>
            <button onClick={reset} className="btn" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
              Reset
            </button>
          </div>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Step size <strong style={{ color: '#fff' }}>+{stepSize}</strong>: gcd({stepSize}, 12) = {gcd(stepSize, 12)},
            so the walk reaches <strong style={{ color: uniqueVisited === 12 || reachable === 12 ? 'var(--success)' : 'var(--warning)' }}>{reachable} of 12</strong> notes
            before looping. {stepSize === 7 ? 'Full coverage — this walk, spelled out, is C G D A E B F♯ D♭ A♭ E♭ B♭ F: the circle of fifths.' :
            stepSize === 5 ? 'Also full coverage — stepping by fourths is the same circle walked backwards.' :
            'A generator must be coprime with 12; this one isn\'t, so it cycles in a subgroup.'}
          </p>
        </div>
      </div>
    </section>
  );
};

// ============================================================
export const PhysicsLab: React.FC = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
    <div className="lab-header">
      <h2 className="lab-title">Sound Physics</h2>
      <p className="lab-description">
        Music theory isn't arbitrary — it falls out of the physics of vibrating strings and a bit of
        modular arithmetic. Four interactive demos, from waveforms to why the circle of fifths exists.
      </p>
    </div>
    <HarmonicExplorer />
    <RatioExplorer />
    <TemperamentTable />
    <ModularCircle />
  </div>
);
export default PhysicsLab;
