import { useRef, useCallback, memo } from 'react';
import { useTick } from '@pixi/react';
import { Container, Graphics as PixiGraphics } from 'pixi.js';
import type { Position, SubAgentInfo } from '../types';
import { PIXEL_TILE_SIZE } from '../types';
import { getSubAgentPosition } from './subAgentLayout';

const S = PIXEL_TILE_SIZE;

// Mini crab sprite grid (10×8 — smaller than parent's 14×13)
const MINI_COLS = 10;
const MINI_ROWS = 8;
const MINI_PX = (S * 0.7) / MINI_COLS;
const MINI_W = MINI_COLS * MINI_PX;
const MINI_H = MINI_ROWS * MINI_PX;

const MINI_A: number[][] = [
  [0,1,1,1,1,1,1,1,1,0],
  [1,1,1,1,1,1,1,1,1,1],
  [1,1,2,1,1,1,1,2,1,1],
  [1,1,1,1,1,1,1,1,1,1],
  [0,1,1,1,1,1,1,1,1,0],
  [0,1,1,1,1,1,1,1,1,0],
  [0,1,0,1,0,0,1,0,1,0],
  [0,1,0,1,0,0,1,0,1,0],
];

const MINI_B: number[][] = [
  [0,1,1,1,1,1,1,1,1,0],
  [1,1,1,1,1,1,1,1,1,1],
  [1,1,2,1,1,1,1,2,1,1],
  [1,1,1,1,1,1,1,1,1,1],
  [0,1,1,1,1,1,1,1,1,0],
  [0,1,1,1,1,1,1,1,1,0],
  [0,1,0,1,0,0,1,0,1,0],
  [1,0,0,0,1,1,0,0,0,1],
];

function lighten(c: number, n: number): number {
  return (
    (Math.min(255, ((c >> 16) & 0xff) + n) << 16) |
    (Math.min(255, ((c >> 8) & 0xff) + n) << 8) |
    Math.min(255, (c & 0xff) + n)
  );
}
function darken(c: number, n: number): number {
  return (
    (Math.max(0, ((c >> 16) & 0xff) - n) << 16) |
    (Math.max(0, ((c >> 8) & 0xff) - n) << 8) |
    Math.max(0, (c & 0xff) - n)
  );
}

function drawMiniCrab(g: PixiGraphics, frame: number[][], bodyColor: number) {
  const px = MINI_PX;
  const ox = -MINI_W / 2;
  const oy = -MINI_H / 2;
  const hi = lighten(bodyColor, 30);
  const lo = darken(bodyColor, 40);

  for (let r = 0; r < MINI_ROWS; r++) {
    for (let c = 0; c < MINI_COLS; c++) {
      const v = frame[r][c];
      if (v === 0) continue;
      const x = ox + c * px;
      const y = oy + r * px;

      if (v === 2) {
        g.rect(x, y, px, px);
        g.fill(0x1a1a1a);
      } else {
        g.rect(x, y, px, px);
        g.fill(bodyColor);
        if (r <= 1) {
          g.rect(x, y, px, px * 0.25);
          g.fill({ color: hi, alpha: 0.35 });
        }
        if (r >= 6) {
          g.rect(x, y + px * 0.75, px, px * 0.25);
          g.fill({ color: lo, alpha: 0.25 });
        }
      }
    }
  }
}

interface SubAgentSpriteProps {
  sub: SubAgentInfo;
  parentDesk: Position;
  index: number;
  parentColor: string;
}

const MOVE_SPEED = 0.25;

export function SubAgentSprite({ sub, parentDesk, index, parentColor }: SubAgentSpriteProps) {
  const containerRef = useRef<Container>(null);
  const bodyRef = useRef<Container>(null);
  const crabRef = useRef<PixiGraphics>(null);
  const lastFrame = useRef<number[][] | null>(null);

  // Wander state
  const wanderTarget = useRef<{ x: number; y: number } | null>(null);
  const wanderTimer = useRef(Math.random() * 3);

  const colorNum = parseInt(parentColor.replace('#', ''), 16);
  const home = getSubAgentPosition(parentDesk, index);

  useTick((ticker) => {
    const container = containerRef.current;
    if (!container) return;
    const dt = ticker.deltaTime;
    const t = performance.now() / 1000;
    const phase = index * 1.3;

    // Wander around home position
    wanderTimer.current -= dt / 60;
    if (wanderTimer.current <= 0 || !wanderTarget.current) {
      wanderTarget.current = {
        x: home.x + (Math.random() * 2 - 1) * S,
        y: home.y + (Math.random() * 2 - 1) * S,
      };
      wanderTimer.current = 2 + Math.random() * 4;
    }

    const tx = wanderTarget.current.x;
    const ty = wanderTarget.current.y;
    const dx = tx - container.x;
    const dy = ty - container.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const isMoving = dist > 2;

    if (dist > 1) {
      const step = Math.min(MOVE_SPEED * Math.min(dt, 3), dist);
      container.x += (dx / dist) * step;
      container.y += (dy / dist) * step;
    }

    // Body bob
    const body = bodyRef.current;
    if (body) {
      body.y = isMoving
        ? Math.sin(t * 7 + phase) * 1.2   // walk bounce
        : Math.sin(t * 2.5 + phase) * 1;  // idle sway
    }

    // Frame animation (fast when moving, slow when idle)
    const period = isMoving ? 0.2 : 1.0;
    const frame = Math.floor((t + phase) / period) % 2 === 0 ? MINI_A : MINI_B;
    const crab = crabRef.current;
    if (crab && frame !== lastFrame.current) {
      lastFrame.current = frame;
      crab.clear();
      drawMiniCrab(crab, frame, colorNum);
    }
  });

  const drawInitial = useCallback((g: PixiGraphics) => {
    drawMiniCrab(g, MINI_A, colorNum);
    lastFrame.current = MINI_A;
  }, [colorNum]);

  const drawShadow = useCallback((g: PixiGraphics) => {
    g.clear();
    g.ellipse(0, MINI_H / 2 + 2, MINI_W * 0.28, 2);
    g.fill({ color: 0x000000, alpha: 0.15 });
  }, []);

  return (
    <pixiContainer ref={containerRef} x={home.x} y={home.y} zIndex={4}>
      <pixiGraphics draw={drawShadow} />
      <pixiContainer ref={bodyRef}>
        <pixiGraphics ref={crabRef} draw={drawInitial} />
      </pixiContainer>

      {/* Name label */}
      <pixiText
        text={sub.name}
        y={MINI_H / 2 + 5}
        anchor={{ x: 0.5, y: 0 }}
        scale={0.5}
        style={{
          fontSize: 20,
          fontWeight: '700',
          fill: 0xffffff,
          fontFamily: 'Inter, sans-serif',
          stroke: { color: 0x000000, width: 4 },
        }}
      />
    </pixiContainer>
  );
}
