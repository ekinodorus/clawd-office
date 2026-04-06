import { useRef, useCallback, useState, useEffect } from 'react';
import { useTick } from '@pixi/react';
import { Container, Graphics as PixiGraphics } from 'pixi.js';
import { PIXEL_TILE_SIZE, MAP_COLS, MAP_ROWS, USER_DESK } from '../types';

const S = PIXEL_TILE_SIZE;
const MOVE_SPEED = 0.35;

// Knurl's speech lines
const SPEECH_LINES = [
  '...zzz',
  'yare yare',
  '...nmu',
  'good work',
  '( @_@ )',
  '~~~~~',
  'slow and steady',
  'nyan',
  '...mog',
  'carry on',
  'nice code',
  'hmm...',
  '...',
];

const KNURL_AA = [
  '      ,>     ',
  '     / .--. ',
  ' @  (  @  ) ',
  '  \\  \\_--_/ ',
  '   \\_------  ',
  '    ~~~~~~~ ',
];

export function UserSprite() {
  const containerRef = useRef<Container>(null);
  const bodyContainerRef = useRef<Container>(null);

  const wanderTarget = useRef<{ x: number; y: number } | null>(null);
  const wanderTimer = useRef(2 + Math.random() * 3);

  const homeX = USER_DESK.x * S + S / 2;
  const homeY = (USER_DESK.y - 1) * S + S / 2;

  // Speech bubble state
  const [speech, setSpeech] = useState<string | null>(null);
  const speechTimer = useRef(8 + Math.random() * 15);

  useEffect(() => {
    const interval = setInterval(() => {
      speechTimer.current -= 1;
      if (speechTimer.current <= 0) {
        const line = SPEECH_LINES[Math.floor(Math.random() * SPEECH_LINES.length)];
        setSpeech(line);
        setTimeout(() => setSpeech(null), 3000);
        speechTimer.current = 15 + Math.random() * 25;
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useTick((ticker) => {
    const container = containerRef.current;
    if (!container) return;
    const dt = ticker.deltaTime;
    const t = performance.now() / 1000;

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

    if (dist > 1) {
      const step = Math.min(MOVE_SPEED * Math.min(dt, 3), dist);
      container.x += (dx / dist) * step;
      container.y += (dy / dist) * step;
    }

    const body = bodyContainerRef.current;
    if (body) {
      body.y = Math.sin(t * 1.2) * 0.5;
      if (dx < -2) body.scale.x = -1;
      else if (dx > 2) body.scale.x = 1;
    }
  });

  const drawSnail = useCallback((g: PixiGraphics) => {
    g.clear();
    // Render each character of the AA as a small colored block
    const charW = 3.2;
    const charH = 5;
    const totalW = 14 * charW;
    const totalH = KNURL_AA.length * charH;
    const ox = -totalW / 2;
    const oy = -totalH / 2;

    for (let r = 0; r < KNURL_AA.length; r++) {
      const line = KNURL_AA[r];
      for (let c = 0; c < line.length; c++) {
        const ch = line[c];
        if (ch === ' ') continue;
        const x = ox + c * charW;
        const y = oy + r * charH;

        let color = 0x40d870; // default green
        if (ch === '@') color = 0x50ff90;
        else if (ch === '~') color = 0x30b858;
        else if (ch === ',') color = 0x60e898;
        else if (ch === '>') color = 0x60e898;

        g.rect(x, y, charW, charH);
        g.fill(color);
      }
    }
  }, []);

  const drawShadow = useCallback((g: PixiGraphics) => {
    g.clear();
    g.ellipse(0, 18, 16, 2.5);
    g.fill({ color: 0x000000, alpha: 0.15 });
  }, []);

  const drawBubble = useCallback((g: PixiGraphics) => {
    g.clear();
    if (!speech) return;
    const w = Math.max(40, speech.length * 6 + 16);
    const h = 18;
    const bx = -w / 2;
    const by = -38;
    // Bubble bg
    g.roundRect(bx, by, w, h, 4);
    g.fill({ color: 0x181850, alpha: 0.92 });
    g.roundRect(bx, by, w, h, 4);
    g.stroke({ color: 0x4848a8, width: 1 });
    // Tail
    g.moveTo(-3, by + h);
    g.lineTo(0, by + h + 5);
    g.lineTo(3, by + h);
    g.fill({ color: 0x181850, alpha: 0.92 });
  }, [speech]);

  return (
    <pixiContainer ref={containerRef} x={homeX} y={homeY}>
      <pixiGraphics draw={drawShadow} />

      <pixiContainer ref={bodyContainerRef}>
        <pixiGraphics draw={drawSnail} />
      </pixiContainer>

      <pixiText
        text="Knurl"
        x={0}
        y={20}
        anchor={{ x: 0.5, y: 0 }}
        style={{
          fontSize: 9,
          fontWeight: '700',
          fill: 0x40d870,
          fontFamily: 'Inter, sans-serif',
          letterSpacing: 1.5,
          stroke: { color: 0x000000, width: 3 },
        }}
      />

      {/* Speech bubble */}
      {speech && (
        <>
          <pixiGraphics draw={drawBubble} />
          <pixiText
            text={speech}
            x={0}
            y={-31}
            anchor={{ x: 0.5, y: 0.5 }}
            style={{
              fontSize: 9,
              fontWeight: '600',
              fill: 0xc8c8e0,
              fontFamily: "'Courier New', monospace",
            }}
          />
        </>
      )}
    </pixiContainer>
  );
}
