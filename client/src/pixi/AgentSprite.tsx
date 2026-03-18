import { useRef, useCallback, useMemo, useEffect } from 'react';
import { useTick } from '@pixi/react';
import { Container, Graphics as PixiGraphics, Rectangle } from 'pixi.js';
import type { AgentInfo, Position } from '../types';
import {
  PIXEL_TILE_SIZE,
  MAP_COLS,
  MAP_ROWS,
  DESK_POSITIONS,
  USER_DESK,
  MEETING_ROOM,
  AGENT_COLORS,
} from '../types';

const S = PIXEL_TILE_SIZE;
const MOVE_SPEED = 0.35; // pixels per frame — constant velocity

// 14×13 crab sprite — only idle frames
const GRID_COLS = 14;
const GRID_ROWS = 13;
const PX_SIZE = (S * 0.95) / GRID_COLS;
const SPRITE_W = GRID_COLS * PX_SIZE;
const SPRITE_H = GRID_ROWS * PX_SIZE;

const IDLE_A: number[][] = [
  [0,1,1,1,1,1,1,1,1,1,1,1,1,0],
  [0,1,1,1,1,1,1,1,1,1,1,1,1,0],
  [0,1,1,1,1,1,1,1,1,1,1,1,1,0],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,1,1,2,2,1,1,1,1,2,2,1,1,1],
  [1,1,1,2,2,1,1,1,1,2,2,1,1,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [0,1,1,1,1,1,1,1,1,1,1,1,1,0],
  [0,1,1,1,1,1,1,1,1,1,1,1,1,0],
  [0,1,1,1,1,1,1,1,1,1,1,1,1,0],
  [0,1,0,0,1,0,0,0,0,1,0,0,1,0],
  [0,1,0,0,1,0,0,0,0,1,0,0,1,0],
  [0,1,0,0,1,0,0,0,0,1,0,0,1,0],
];

const IDLE_B: number[][] = [
  [0,1,1,1,1,1,1,1,1,1,1,1,1,0],
  [0,1,1,1,1,1,1,1,1,1,1,1,1,0],
  [0,1,1,1,1,1,1,1,1,1,1,1,1,0],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,1,1,2,2,1,1,1,1,2,2,1,1,1],
  [1,1,1,2,2,1,1,1,1,2,2,1,1,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [0,1,1,1,1,1,1,1,1,1,1,1,1,0],
  [0,1,1,1,1,1,1,1,1,1,1,1,1,0],
  [0,1,1,1,1,1,1,1,1,1,1,1,1,0],
  [0,1,0,0,1,0,0,0,0,1,0,0,1,0],
  [0,1,0,0,1,0,0,0,0,1,0,0,1,0],
  [1,0,0,0,0,1,0,0,1,0,0,0,0,1],
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

function drawCrabFrame(g: PixiGraphics, frame: number[][], bodyColor: number) {
  const px = PX_SIZE;
  const ox = -SPRITE_W / 2;
  const oy = -SPRITE_H / 2;
  const hi = lighten(bodyColor, 30);
  const lo = darken(bodyColor, 40);

  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
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
        if (r <= 3) {
          g.rect(x, y, px, px * 0.25);
          g.fill({ color: hi, alpha: 0.35 });
        }
        if (r >= 9) {
          g.rect(x, y + px * 0.75, px, px * 0.25);
          g.fill({ color: lo, alpha: 0.25 });
        }
      }
    }
  }
}

function getHomePosition(agent: AgentInfo): Position {
  const desk = DESK_POSITIONS[agent.deskIndex] ?? DESK_POSITIONS[0];
  switch (agent.state) {
    case 'planning':
      return MEETING_ROOM;
    default:
      return desk;
  }
}

// Clamp tile coords inside cave walls
function clampTile(x: number, y: number): Position {
  return {
    x: Math.max(2, Math.min(MAP_COLS - 3, x)),
    y: Math.max(2, Math.min(MAP_ROWS - 3, y)),
  };
}

interface AgentSpriteProps {
  agent: AgentInfo;
  isSelected: boolean;
  onClick: () => void;
}

export function AgentSprite({ agent, isSelected, onClick }: AgentSpriteProps) {
  const containerRef = useRef<Container>(null);
  const bodyContainerRef = useRef<Container>(null);
  const crabRef = useRef<PixiGraphics>(null);
  const glowRef = useRef<PixiGraphics>(null);
  const lastFrame = useRef<number[][] | null>(null);

  // Wander state
  const wanderTarget = useRef<{ x: number; y: number } | null>(null);
  const wanderTimer = useRef(1 + Math.random() * 2);

  const color = agent.color || AGENT_COLORS[agent.deskIndex % AGENT_COLORS.length];
  const colorNum = parseInt(color.replace('#', ''), 16);
  const isIdle = agent.state === 'idle';
  const isWorking = agent.state !== 'idle' && agent.state !== 'error';

  const home = useMemo(() => getHomePosition(agent), [agent.state, agent.deskIndex]);
  const initialized = useRef(false);

  const truncatedAction = agent.currentAction.length > 24
    ? agent.currentAction.substring(0, 22) + '..'
    : agent.currentAction;

  // Track home position changes to reset wander target (smooth transition)
  const prevHome = useRef(home);
  useEffect(() => {
    if (prevHome.current.x !== home.x || prevHome.current.y !== home.y) {
      prevHome.current = home;
      // Set wander target directly to new home so sprite walks there smoothly
      wanderTarget.current = { x: home.x * S + S / 2, y: (home.y - 1) * S + S / 2 };
      wanderTimer.current = 2 + Math.random() * 2; // Wander again after reaching home
    }
  }, [home]);

  useTick((ticker) => {
    const container = containerRef.current;
    if (!container) return;

    // Set initial position only once (avoid React re-render overwriting position)
    if (!initialized.current) {
      initialized.current = true;
      container.x = home.x * S + S / 2;
      container.y = (home.y - 1) * S + S / 2;
    }

    const dt = ticker.deltaTime;
    const t = performance.now() / 1000;

    // Determine movement target
    let tx: number;
    let ty: number;

    // Always wander around home position (idle = wider range, working = tighter)
    wanderTimer.current -= dt / 60;
    if (wanderTimer.current <= 0 || !wanderTarget.current) {
      const range = isIdle ? 4 : 2;
      const interval = isIdle ? [4, 6] : [2, 4];
      const p = clampTile(
        home.x + (Math.random() * range - range / 2),
        home.y + (Math.random() * range - range / 2),
      );
      wanderTarget.current = { x: p.x * S + S / 2, y: (p.y - 1) * S + S / 2 };
      wanderTimer.current = interval[0] + Math.random() * interval[1];
    }
    tx = wanderTarget.current.x;
    ty = wanderTarget.current.y;

    // Constant-speed movement (DQ-style uniform walk)
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
    const body = bodyContainerRef.current;
    if (body) {
      body.y = isMoving
        ? Math.sin(t * 6) * 1.5   // walk bounce
        : Math.sin(t * 2.5) * 1;  // idle sway
    }

    // Work glow
    const glow = glowRef.current;
    if (glow) {
      const a = isWorking ? 0.22 + Math.sin(t * 3) * 0.1 : 0;
      glow.alpha += (a - glow.alpha) * 0.08;
    }

    // Animation: fast cycle when moving, slow when standing
    const period = isMoving ? 0.2 : 0.9;
    const frame = Math.floor(t / period) % 2 === 0 ? IDLE_A : IDLE_B;

    const crab = crabRef.current;
    if (crab && frame !== lastFrame.current) {
      lastFrame.current = frame;
      crab.clear();
      drawCrabFrame(crab, frame, colorNum);
    }
  });

  const drawInitial = useCallback((g: PixiGraphics) => {
    drawCrabFrame(g, IDLE_A, colorNum);
    lastFrame.current = IDLE_A;
  }, [colorNum]);

  const drawGlow = useCallback((g: PixiGraphics) => {
    g.clear();
    g.circle(0, 0, S * 0.5);
    g.fill({ color: colorNum, alpha: 0.3 });
  }, [colorNum]);

  const drawShadow = useCallback((g: PixiGraphics) => {
    g.clear();
    g.ellipse(0, SPRITE_H / 2 + 3, SPRITE_W * 0.28, 2.5);
    g.fill({ color: 0x000000, alpha: 0.18 });
  }, []);

  const drawBadge = useCallback((g: PixiGraphics) => {
    g.clear();
    g.circle(0, 0, 7);
    g.fill({ color: colorNum, alpha: 0.9 });
    g.circle(0, 0, 7);
    g.stroke({ width: 1, color: 0xffffff, alpha: 0.6 });
  }, [colorNum]);

  const drawBubbleBg = useCallback((g: PixiGraphics) => {
    g.clear();
    if (!truncatedAction) return;
    const len = truncatedAction.length;
    const w = Math.max(len * 6 + 28, 60);
    const h = 20;
    const r = h / 2; // pill shape

    // Drop shadow
    g.roundRect(-w / 2 + 1, -h / 2 + 2, w, h, r);
    g.fill({ color: 0x000000, alpha: 0.3 });

    // Background
    g.roundRect(-w / 2, -h / 2, w, h, r);
    g.fill({ color: 0x141434, alpha: 0.92 });

    // Agent-colored border
    g.roundRect(-w / 2, -h / 2, w, h, r);
    g.stroke({ width: 1, color: colorNum, alpha: 0.4 });

    // Subtle tail
    g.moveTo(-2, h / 2 - 1);
    g.lineTo(0, h / 2 + 3);
    g.lineTo(2, h / 2 - 1);
    g.closePath();
    g.fill({ color: 0x141434, alpha: 0.92 });
  }, [truncatedAction, colorNum]);

  const hitArea = useMemo(() => {
    const pad = S * 0.6;
    return new Rectangle(-SPRITE_W / 2 - pad, -SPRITE_H / 2 - pad, SPRITE_W + pad * 2, SPRITE_H + pad * 2);
  }, []);

  return (
    <pixiContainer
      ref={containerRef}
      eventMode="static"
      cursor="pointer"
      hitArea={hitArea}
      zIndex={isSelected ? 10 : 5}
      onPointerDown={(e: any) => { e.stopPropagation(); onClick(); }}
      scale={isSelected ? 1.2 : 1}
    >
      <pixiGraphics ref={glowRef} draw={drawGlow} alpha={0} />
      <pixiGraphics draw={drawShadow} />

      <pixiContainer ref={bodyContainerRef}>
        <pixiGraphics ref={crabRef} draw={drawInitial} />
      </pixiContainer>

      <pixiText
        text={agent.name}
        x={0}
        y={SPRITE_H / 2 + 8}
        anchor={{ x: 0.5, y: 0 }}
        scale={0.5}
        style={{
          fontSize: 18,
          fontWeight: '700',
          fill: 0xffffff,
          fontFamily: 'Inter, sans-serif',
          stroke: { color: 0x000000, width: 3 },
        }}
      />

      {agent.currentAction && (
        <pixiContainer y={-SPRITE_H / 2 - 20}>
          <pixiGraphics draw={drawBubbleBg} />
          <pixiText
            text={truncatedAction}
            anchor={0.5}
            scale={0.5}
            style={{
              fontSize: 20,
              fontWeight: '600',
              fill: 0xe0e0ff,
              fontFamily: 'Inter, sans-serif',
            }}
          />
        </pixiContainer>
      )}

      {/* Question icon when waiting for user */}
      {agent.state === 'waiting_for_user' && (
        <pixiText
          text="❓"
          x={SPRITE_W / 2 + 2}
          y={-SPRITE_H / 2 - 6}
          anchor={0.5}
          scale={0.7}
          style={{
            fontSize: 24,
          }}
        />
      )}

      {/* Sub-agent count badge */}
      {(agent.subAgents ?? []).length > 0 && (
        <pixiContainer x={SPRITE_W / 2 + 2} y={SPRITE_H / 2 - 2}>
          <pixiGraphics draw={drawBadge} />
          <pixiText
            text={String((agent.subAgents ?? []).length)}
            anchor={0.5}
            scale={0.4}
            style={{
              fontSize: 20,
              fontWeight: '800',
              fill: 0xffffff,
              fontFamily: 'Inter, sans-serif',
            }}
          />
        </pixiContainer>
      )}
    </pixiContainer>
  );
}
