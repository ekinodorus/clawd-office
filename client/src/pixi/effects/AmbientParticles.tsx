import { useRef, useMemo } from 'react';
import { useTick } from '@pixi/react';
import { Graphics as PixiGraphics } from 'pixi.js';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../../types';

const PARTICLE_COUNT = 30;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  baseAlpha: number;
  phase: number;
  color: number;
}

const noop = () => {};

function createParticles(): Particle[] {
  const colors = [0xffffff, 0x93c5fd, 0xc4b5fd, 0xa7f3d0];
  return Array.from({ length: PARTICLE_COUNT }, () => ({
    x: Math.random() * CANVAS_WIDTH,
    y: Math.random() * CANVAS_HEIGHT,
    vx: (Math.random() - 0.5) * 0.25,
    vy: -Math.random() * 0.15 - 0.05,
    size: Math.random() * 2 + 0.8,
    baseAlpha: Math.random() * 0.12 + 0.04,
    phase: Math.random() * Math.PI * 2,
    color: colors[Math.floor(Math.random() * colors.length)],
  }));
}

export function AmbientParticles() {
  const particles = useMemo(() => createParticles(), []);
  const gRef = useRef<PixiGraphics>(null);

  useTick((ticker) => {
    const g = gRef.current;
    if (!g) return;

    const dt = ticker.deltaTime;
    const t = performance.now() / 1000;

    g.clear();

    for (const p of particles) {
      p.x += p.vx * dt + Math.sin(t * 0.8 + p.phase) * 0.12;
      p.y += p.vy * dt;

      // Wrap around
      if (p.y < -10) {
        p.y = CANVAS_HEIGHT + 10;
        p.x = Math.random() * CANVAS_WIDTH;
      }
      if (p.x < -10) p.x = CANVAS_WIDTH + 10;
      if (p.x > CANVAS_WIDTH + 10) p.x = -10;

      const alpha = p.baseAlpha + Math.sin(t * 1.2 + p.phase) * 0.04;

      // Soft glow circle
      g.circle(p.x, p.y, p.size * 2);
      g.fill({ color: p.color, alpha: Math.max(0, alpha * 0.3) });
      // Core dot
      g.circle(p.x, p.y, p.size);
      g.fill({ color: p.color, alpha: Math.max(0, alpha) });
    }
  });

  return <pixiGraphics ref={gRef} draw={noop} />;
}
