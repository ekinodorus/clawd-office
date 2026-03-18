import { useRef, useCallback } from 'react';
import { useTick } from '@pixi/react';
import { Container, Graphics as PixiGraphics } from 'pixi.js';
import { PIXEL_TILE_SIZE, MAP_COLS, MAP_ROWS, USER_DESK } from '../types';

const S = PIXEL_TILE_SIZE;

const GRID_COLS = 10;
const GRID_ROWS = 14;
const PX_SIZE = (S * 0.95) / GRID_COLS;
const SPRITE_W = GRID_COLS * PX_SIZE;
const SPRITE_H = GRID_ROWS * PX_SIZE;

const MOVE_SPEED = 0.7; // pixels per frame — constant velocity

const COLOR_MAP: Record<number, number> = {
  1: 0xf5c48a,
  2: 0x1e293b,
  3: 0xd4956a,
  4: 0x10b981,
  5: 0x334155,
  6: 0x1e293b,
  7: 0x5c3d2e,
};

const IDLE_A: number[][] = [
  [0,0,0,7,7,7,7,0,0,0],
  [0,0,7,7,7,7,7,7,0,0],
  [0,0,1,1,1,1,1,1,0,0],
  [0,1,1,1,1,1,1,1,1,0],
  [0,1,2,1,1,1,1,2,1,0],
  [0,1,1,1,1,1,1,1,1,0],
  [0,0,1,1,3,3,1,1,0,0],
  [0,0,0,4,4,4,4,0,0,0],
  [0,4,4,4,4,4,4,4,4,0],
  [0,4,4,4,4,4,4,4,4,0],
  [0,0,0,4,4,4,4,0,0,0],
  [0,0,0,5,5,5,5,0,0,0],
  [0,0,0,5,0,0,5,0,0,0],
  [0,0,6,6,0,0,6,6,0,0],
];

const IDLE_B: number[][] = [
  [0,0,0,7,7,7,7,0,0,0],
  [0,0,7,7,7,7,7,7,0,0],
  [0,0,1,1,1,1,1,1,0,0],
  [0,1,1,1,1,1,1,1,1,0],
  [0,1,2,1,1,1,1,2,1,0],
  [0,1,1,1,1,1,1,1,1,0],
  [0,0,1,1,3,3,1,1,0,0],
  [0,4,0,4,4,4,4,0,4,0],
  [0,4,4,4,4,4,4,4,4,0],
  [0,0,4,4,4,4,4,4,0,0],
  [0,0,0,4,4,4,4,0,0,0],
  [0,0,0,5,5,5,5,0,0,0],
  [0,0,0,5,0,0,5,0,0,0],
  [0,0,6,6,0,0,6,6,0,0],
];

function drawHumanFrame(g: PixiGraphics, frame: number[][]) {
  const px = PX_SIZE;
  const ox = -SPRITE_W / 2;
  const oy = -SPRITE_H / 2;

  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      const v = frame[r][c];
      if (v === 0) continue;
      const x = ox + c * px;
      const y = oy + r * px;
      const color = COLOR_MAP[v];

      g.rect(x, y, px, px);
      g.fill(color);

      if ((v === 7 || (v === 1 && r <= 3)) && r <= 2) {
        g.rect(x, y, px, px * 0.25);
        g.fill({ color: 0xffffff, alpha: 0.2 });
      }
      if (v === 4 && r <= 8) {
        g.rect(x, y, px, px * 0.25);
        g.fill({ color: 0xffffff, alpha: 0.15 });
      }
      if ((v === 5 || v === 6) && r >= 12) {
        g.rect(x, y + px * 0.75, px, px * 0.25);
        g.fill({ color: 0x000000, alpha: 0.15 });
      }
    }
  }
}

export function UserSprite() {
  const containerRef = useRef<Container>(null);
  const bodyContainerRef = useRef<Container>(null);
  const spriteRef = useRef<PixiGraphics>(null);
  const lastFrame = useRef<number[][] | null>(null);

  // Wander state
  const wanderTarget = useRef<{ x: number; y: number } | null>(null);
  const wanderTimer = useRef(2 + Math.random() * 3);

  const homeX = USER_DESK.x * S + S / 2;
  const homeY = (USER_DESK.y - 1) * S + S / 2;

  useTick((ticker) => {
    const container = containerRef.current;
    if (!container) return;
    const dt = ticker.deltaTime;
    const t = performance.now() / 1000;

    // Wander around home
    wanderTimer.current -= dt / 60;
    if (wanderTimer.current <= 0 || !wanderTarget.current) {
      const wx = Math.max(2, Math.min(MAP_COLS - 3, USER_DESK.x + (Math.random() * 6 - 3)));
      const wy = Math.max(2, Math.min(MAP_ROWS - 3, USER_DESK.y + (Math.random() * 6 - 3)));
      wanderTarget.current = { x: wx * S + S / 2, y: (wy - 1) * S + S / 2 };
      wanderTimer.current = 4 + Math.random() * 5;
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

    const body = bodyContainerRef.current;
    if (body) {
      body.y = isMoving
        ? Math.sin(t * 6) * 1.5
        : Math.sin(t * 1.5) * 0.8;
    }

    const period = isMoving ? 0.25 : 1.2;
    const frame = Math.floor(t / period) % 2 === 0 ? IDLE_A : IDLE_B;

    const sprite = spriteRef.current;
    if (sprite && frame !== lastFrame.current) {
      lastFrame.current = frame;
      sprite.clear();
      drawHumanFrame(sprite, frame);
    }
  });

  const drawInitial = useCallback((g: PixiGraphics) => {
    drawHumanFrame(g, IDLE_A);
    lastFrame.current = IDLE_A;
  }, []);

  const drawShadow = useCallback((g: PixiGraphics) => {
    g.clear();
    g.ellipse(0, SPRITE_H / 2 + 3, SPRITE_W * 0.28, 2.5);
    g.fill({ color: 0x000000, alpha: 0.18 });
  }, []);

  return (
    <pixiContainer ref={containerRef} x={homeX} y={homeY}>
      <pixiGraphics draw={drawShadow} />

      <pixiContainer ref={bodyContainerRef}>
        <pixiGraphics ref={spriteRef} draw={drawInitial} />
      </pixiContainer>

      <pixiText
        text="YOU"
        x={0}
        y={SPRITE_H / 2 + 8}
        anchor={{ x: 0.5, y: 0 }}
        style={{
          fontSize: 9,
          fontWeight: '700',
          fill: 0xffffff,
          fontFamily: 'Inter, sans-serif',
          letterSpacing: 1.5,
          stroke: { color: 0x000000, width: 3 },
        }}
      />
    </pixiContainer>
  );
}
