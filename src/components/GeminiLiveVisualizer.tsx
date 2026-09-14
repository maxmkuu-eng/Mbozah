import React, { useEffect, useRef } from 'react';
import { VoiceState, LiveStreamVisualEffect } from '../types';

interface GeminiLiveVisualizerProps {
  voiceState: VoiceState;
  audioLevel: number; // 0.0 to 1.0
  visualEffect: LiveStreamVisualEffect;
  ambientGlow: boolean;
  onClick?: () => void;
  size?: number;
}

interface Particle {
  angle: number;
  distance: number;
  speed: number;
  size: number;
  opacity: number;
  hue: number;
}

export const GeminiLiveVisualizer: React.FC<GeminiLiveVisualizerProps> = ({
  voiceState,
  audioLevel,
  visualEffect = 'fluid_orb',
  ambientGlow = true,
  onClick,
  size = 280,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const timeRef = useRef<number>(0);
  const smoothedAudioRef = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);

  // Initialize ambient micro-particles
  useEffect(() => {
    const p: Particle[] = [];
    for (let i = 0; i < 28; i++) {
      p.push({
        angle: Math.random() * Math.PI * 2,
        distance: 40 + Math.random() * 80,
        speed: (Math.random() * 0.015 + 0.005) * (Math.random() > 0.5 ? 1 : -1),
        size: Math.random() * 2.5 + 1.2,
        opacity: Math.random() * 0.7 + 0.3,
        hue: [210, 240, 270, 310, 45][Math.floor(Math.random() * 5)],
      });
    }
    particlesRef.current = p;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let isRunning = true;

    const render = () => {
      if (!isRunning) return;

      const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;
      const cx = width / 2;
      const cy = height / 2;

      timeRef.current += 0.025;
      const t = timeRef.current;

      // Smooth audio level with fast rise and slow decay
      const targetAudio = Math.max(0, Math.min(1, audioLevel));
      smoothedAudioRef.current += (targetAudio - smoothedAudioRef.current) * 0.22;
      const level = smoothedAudioRef.current;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.scale(dpr, dpr);

      // 1. Ambient Background Aura (Gemini Gradient Glow)
      if (ambientGlow) {
        const glowRadius = Math.min(width, height) * (0.38 + level * 0.2);
        const glowGrad = ctx.createRadialGradient(cx, cy, 10, cx, cy, glowRadius);

        if (voiceState === 'listening') {
          glowGrad.addColorStop(0, 'rgba(56, 189, 248, 0.45)');
          glowGrad.addColorStop(0.4, 'rgba(59, 130, 246, 0.25)');
          glowGrad.addColorStop(0.7, 'rgba(147, 51, 234, 0.12)');
          glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        } else if (voiceState === 'thinking') {
          glowGrad.addColorStop(0, 'rgba(168, 85, 247, 0.5)');
          glowGrad.addColorStop(0.4, 'rgba(236, 72, 153, 0.3)');
          glowGrad.addColorStop(0.8, 'rgba(99, 102, 241, 0.1)');
          glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        } else if (voiceState === 'speaking') {
          glowGrad.addColorStop(0, 'rgba(212, 175, 55, 0.4)');
          glowGrad.addColorStop(0.35, 'rgba(147, 51, 234, 0.25)');
          glowGrad.addColorStop(0.7, 'rgba(59, 130, 246, 0.15)');
          glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        } else if (voiceState === 'error') {
          glowGrad.addColorStop(0, 'rgba(239, 68, 68, 0.4)');
          glowGrad.addColorStop(0.6, 'rgba(185, 28, 28, 0.15)');
          glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        } else {
          // Ready / Ambient State
          glowGrad.addColorStop(0, 'rgba(78, 136, 255, 0.32)');
          glowGrad.addColorStop(0.4, 'rgba(155, 114, 207, 0.2)');
          glowGrad.addColorStop(0.75, 'rgba(217, 101, 112, 0.08)');
          glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        }

        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, glowRadius, 0, Math.PI * 2);
        ctx.fill();
      }

      // 2. Render Based on Selected Visual Effect
      if (visualEffect === 'aurora_wave') {
        renderAuroraWaves(ctx, cx, cy, width, height, t, level, voiceState);
      } else if (visualEffect === 'radiant_star') {
        renderRadiantStar(ctx, cx, cy, t, level, voiceState);
      } else if (visualEffect === 'kinetic_bars') {
        renderKineticBars(ctx, cx, cy, width, height, t, level, voiceState);
      } else {
        // Default: 'fluid_orb' (The iconic Gemini Liquid Orb)
        renderFluidOrb(ctx, cx, cy, t, level, voiceState);
      }

      // 3. Floating Starlight / Celestial Particles
      renderParticles(ctx, cx, cy, t, level);

      ctx.restore();
      animationFrameRef.current = requestAnimationFrame(render);
    };

    animationFrameRef.current = requestAnimationFrame(render);

    return () => {
      isRunning = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [voiceState, audioLevel, visualEffect, ambientGlow, size]);

  // Handler for High-DPI canvas resizing
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
  }, [size]);

  // --- RENDERER: 1. GEMINI FLUID LIQUID ORB ---
  const renderFluidOrb = (
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    t: number,
    level: number,
    state: VoiceState
  ) => {
    const baseR = size * 0.22;
    const dynamicR = baseR + level * 28 + (state === 'thinking' ? Math.sin(t * 3) * 6 : Math.sin(t * 1.5) * 4);
    const numPoints = 120;

    // A. Outer Concentric Ripple Rings (Gemini Soundwave Emission)
    if (level > 0.08 || state === 'speaking' || state === 'listening') {
      const ringCount = 3;
      for (let r = 1; r <= ringCount; r++) {
        const ringProgress = ((t * 0.6 + r * 0.33) % 1);
        const ringRadius = dynamicR + ringProgress * (size * 0.26);
        const ringAlpha = (1 - ringProgress) * (0.35 + level * 0.4);

        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, ringRadius, 0, Math.PI * 2);
        ctx.lineWidth = 1.5 + level * 2;
        ctx.strokeStyle =
          state === 'listening'
            ? `rgba(56, 189, 248, ${ringAlpha})`
            : state === 'speaking'
            ? `rgba(212, 175, 55, ${ringAlpha})`
            : `rgba(168, 85, 247, ${ringAlpha})`;
        ctx.stroke();
        ctx.restore();
      }
    }

    // B. Main Liquid Morphing Blob (Using Multi-harmonic Sine Waves)
    ctx.save();
    ctx.beginPath();

    const speedMult = state === 'thinking' ? 2.5 : state === 'listening' ? 1.6 : 1.0;
    const deformAmp = 6 + level * 22;

    for (let i = 0; i <= numPoints; i++) {
      const angle = (i / numPoints) * Math.PI * 2;

      // Multi-harmonic orbital displacement simulating organic liquid viscosity
      const h1 = Math.sin(angle * 2 + t * speedMult * 1.4) * deformAmp;
      const h2 = Math.cos(angle * 3 - t * speedMult * 1.8) * (deformAmp * 0.7);
      const h3 = Math.sin(angle * 5 + t * speedMult * 2.2) * (deformAmp * 0.35);
      const hAudio = Math.sin(angle * 7 - t * 3.0) * (level * 18);

      const r = Math.max(15, dynamicR + h1 + h2 + h3 + hAudio);
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.closePath();

    // Fill with Gemini Gradient Mesh
    const orbGrad = ctx.createRadialGradient(
      cx - dynamicR * 0.25,
      cy - dynamicR * 0.3,
      dynamicR * 0.1,
      cx,
      cy,
      dynamicR * 1.15
    );

    if (state === 'listening') {
      orbGrad.addColorStop(0, '#e0f2fe'); // ice cyan white
      orbGrad.addColorStop(0.25, '#38bdf8'); // sky blue
      orbGrad.addColorStop(0.65, '#2563eb'); // electric blue
      orbGrad.addColorStop(0.92, '#7c3aed'); // deep violet
      orbGrad.addColorStop(1, '#1e1b4b');
    } else if (state === 'thinking') {
      orbGrad.addColorStop(0, '#fdf2f8'); // bright pink white
      orbGrad.addColorStop(0.25, '#f472b6'); // neon pink
      orbGrad.addColorStop(0.6, '#a855f7'); // purple
      orbGrad.addColorStop(0.85, '#6366f1'); // indigo
      orbGrad.addColorStop(1, '#312e81');
    } else if (state === 'speaking') {
      orbGrad.addColorStop(0, '#fffbeb'); // bright warm light
      orbGrad.addColorStop(0.25, '#F5D77F'); // gold
      orbGrad.addColorStop(0.6, '#D4AF37'); // mkuu gold
      orbGrad.addColorStop(0.85, '#7c3aed'); // violet contrast
      orbGrad.addColorStop(1, '#1e1b4b');
    } else if (state === 'error') {
      orbGrad.addColorStop(0, '#fef2f2');
      orbGrad.addColorStop(0.35, '#f87171');
      orbGrad.addColorStop(0.75, '#dc2626');
      orbGrad.addColorStop(1, '#450a0a');
    } else {
      // Ready State (Signature Gemini Quad-Gradient: Blue -> Cyan -> Purple -> Coral)
      orbGrad.addColorStop(0, '#ffffff');
      orbGrad.addColorStop(0.2, '#60a5fa');
      orbGrad.addColorStop(0.5, '#4E88FF');
      orbGrad.addColorStop(0.8, '#9B72CF');
      orbGrad.addColorStop(1, '#D96570');
    }

    ctx.fillStyle = orbGrad;
    ctx.shadowColor = state === 'listening' ? '#38bdf8' : state === 'speaking' ? '#D4AF37' : '#9B72CF';
    ctx.shadowBlur = 24 + level * 20;
    ctx.fill();

    // Subtle Chromatic Edge Outline
    ctx.lineWidth = 2 + level * 2;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.stroke();
    ctx.restore();

    // C. Internal Sub-Liquid Specular Refraction (Glass / Liquid 3D Core)
    ctx.save();
    ctx.beginPath();
    const innerR = dynamicR * 0.55;
    ctx.ellipse(
      cx - dynamicR * 0.18,
      cy - dynamicR * 0.22,
      innerR * (1 + level * 0.2),
      innerR * 0.65,
      Math.PI / 4,
      0,
      Math.PI * 2
    );
    const specularGrad = ctx.createLinearGradient(
      cx - dynamicR * 0.4,
      cy - dynamicR * 0.4,
      cx,
      cy
    );
    specularGrad.addColorStop(0, 'rgba(255, 255, 255, 0.65)');
    specularGrad.addColorStop(0.6, 'rgba(255, 255, 255, 0.15)');
    specularGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = specularGrad;
    ctx.fill();
    ctx.restore();

    // D. Center Gemini Sparkle Core Icon
    renderGeminiSparkle(ctx, cx, cy, dynamicR * 0.28, t, state);
  };

  // --- RENDERER: 2. GEMINI AURORA WAVES ---
  const renderAuroraWaves = (
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    width: number,
    height: number,
    t: number,
    level: number,
    state: VoiceState
  ) => {
    const waveCount = 4;
    const waveColors = [
      ['rgba(78, 136, 255, 0.6)', 'rgba(59, 130, 246, 0)'],
      ['rgba(155, 114, 207, 0.55)', 'rgba(147, 51, 234, 0)'],
      ['rgba(56, 189, 248, 0.65)', 'rgba(6, 182, 212, 0)'],
      ['rgba(212, 175, 55, 0.5)', 'rgba(245, 215, 127, 0)'],
    ];

    for (let w = 0; w < waveCount; w++) {
      ctx.save();
      ctx.beginPath();
      const yBase = cy + (w - 1.5) * 18;
      const freq = 0.015 + w * 0.006;
      const amp = 14 + level * 36 + Math.sin(t * 1.5 + w) * 6;
      const phase = t * (1.2 + w * 0.4) * (w % 2 === 0 ? 1 : -1);

      ctx.moveTo(0, height);
      ctx.lineTo(0, yBase);

      for (let x = 0; x <= width; x += 6) {
        const y = yBase + Math.sin(x * freq + phase) * amp + Math.cos(x * 0.008 - phase * 0.7) * (amp * 0.5);
        ctx.lineTo(x, y);
      }

      ctx.lineTo(width, height);
      ctx.closePath();

      const grad = ctx.createLinearGradient(0, yBase - amp, 0, height);
      grad.addColorStop(0, waveColors[w][0]);
      grad.addColorStop(1, waveColors[w][1]);
      ctx.fillStyle = grad;
      ctx.fill();

      // Glowing Crest
      ctx.lineWidth = 2 + (w === 2 ? level * 3 : 1);
      ctx.strokeStyle = waveColors[w][0];
      ctx.stroke();
      ctx.restore();
    }

    renderGeminiSparkle(ctx, cx, cy - 25, 24 + level * 8, t, state);
  };

  // --- RENDERER: 3. GEMINI RADIANT STAR ---
  const renderRadiantStar = (
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    t: number,
    level: number,
    state: VoiceState
  ) => {
    const starR = size * 0.25 + level * 30;
    const rotSpeed = state === 'thinking' ? 1.5 : 0.3;
    const angleOffset = t * rotSpeed;

    // Glowing Halo Rings
    for (let i = 1; i <= 3; i++) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, starR * (0.6 + i * 0.35 + level * 0.4), 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(155, 114, 207, ${0.35 / i})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }

    // Four-Pointed Gemini Star Polygon
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angleOffset);

    ctx.beginPath();
    const outer = starR;
    const inner = starR * 0.22;
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      const r = i % 2 === 0 ? outer : inner;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();

    const starGrad = ctx.createRadialGradient(0, 0, 5, 0, 0, outer);
    starGrad.addColorStop(0, '#ffffff');
    starGrad.addColorStop(0.3, '#38bdf8');
    starGrad.addColorStop(0.7, '#9333ea');
    starGrad.addColorStop(1, '#D4AF37');

    ctx.fillStyle = starGrad;
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 25 + level * 25;
    ctx.fill();
    ctx.restore();
  };

  // --- RENDERER: 4. GEMINI KINETIC BARS ---
  const renderKineticBars = (
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    width: number,
    height: number,
    t: number,
    level: number,
    state: VoiceState
  ) => {
    const numBars = 24;
    const barWidth = 4.5;
    const spacing = 7;
    const totalW = numBars * (barWidth + spacing);
    const startX = cx - totalW / 2;

    for (let i = 0; i < numBars; i++) {
      const distFromCenter = Math.abs(i - numBars / 2) / (numBars / 2);
      const waveOffset = Math.sin(t * 3.5 + i * 0.35);
      const minH = 10;
      const dynamicH = minH + (1 - distFromCenter) * (level * 110 + 20) + waveOffset * 8;
      const barH = Math.max(8, Math.min(height * 0.45, dynamicH));

      const bx = startX + i * (barWidth + spacing);
      const by = cy - barH / 2;

      ctx.save();
      const barGrad = ctx.createLinearGradient(bx, by, bx, by + barH);
      barGrad.addColorStop(0, '#38bdf8');
      barGrad.addColorStop(0.5, '#a855f7');
      barGrad.addColorStop(1, '#D4AF37');

      ctx.fillStyle = barGrad;
      ctx.beginPath();
      // Rounded pill bar
      const r = barWidth / 2;
      ctx.roundRect(bx, by, barWidth, barH, [r, r, r, r]);
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 10 + level * 10;
      ctx.fill();
      ctx.restore();
    }
  };

  // --- RENDERER: GEMINI 4-POINT SPARKLE CORE ---
  const renderGeminiSparkle = (
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    size: number,
    t: number,
    state: VoiceState
  ) => {
    ctx.save();
    ctx.translate(cx, cy);

    // Subtle rotation or pulse
    const pulse = 1 + Math.sin(t * 2) * 0.08;
    ctx.scale(pulse, pulse);

    ctx.beginPath();
    const R = size;
    // Cubic bezier curves forming the iconic star
    ctx.moveTo(0, -R);
    ctx.quadraticCurveTo(0, 0, R, 0);
    ctx.quadraticCurveTo(0, 0, 0, R);
    ctx.quadraticCurveTo(0, 0, -R, 0);
    ctx.quadraticCurveTo(0, 0, 0, -R);
    ctx.closePath();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 16;
    ctx.fill();
    ctx.restore();
  };

  // --- RENDERER: CELESTIAL AMBIENT PARTICLES ---
  const renderParticles = (
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    t: number,
    level: number
  ) => {
    const particles = particlesRef.current;
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.angle += p.speed;
      const currentDist = p.distance + Math.sin(t + i) * 12 + level * 20;

      const px = cx + Math.cos(p.angle) * currentDist;
      const py = cy + Math.sin(p.angle) * currentDist;

      ctx.save();
      ctx.beginPath();
      ctx.arc(px, py, p.size * (1 + level * 0.4), 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${p.hue}, 90%, 65%, ${p.opacity * (0.6 + level * 0.4)})`;
      ctx.shadowColor = `hsl(${p.hue}, 90%, 65%)`;
      ctx.shadowBlur = 6;
      ctx.fill();
      ctx.restore();
    }
  };

  return (
    <div
      onClick={onClick}
      className="relative flex items-center justify-center cursor-pointer select-none group"
      style={{ width: size, height: size }}
      title="Gusa hapa kubadili hali ya sauti au kuongea"
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full block transform transition-transform duration-300 group-hover:scale-105"
      />
    </div>
  );
};

export default GeminiLiveVisualizer;
