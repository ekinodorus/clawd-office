import { useEffect, useRef } from 'react';

// Same 14×13 crab sprite data as AgentSprite
const GRID_COLS = 14;
const GRID_ROWS = 13;

const CRAB: number[][] = [
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

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

interface CrabIconProps {
  color: string;
  size?: number;
}

export function CrabIcon({ color, size = 24 }: CrabIconProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const px = size / GRID_COLS;
    canvas.width = size;
    canvas.height = Math.ceil(GRID_ROWS * px);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const [r, g, b] = hexToRgb(color);

    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const v = CRAB[row][col];
        if (v === 0) continue;
        const x = col * px;
        const y = row * px;
        if (v === 2) {
          ctx.fillStyle = '#1a1a1a';
        } else {
          ctx.fillStyle = `rgb(${r},${g},${b})`;
        }
        ctx.fillRect(x, y, Math.ceil(px), Math.ceil(px));
      }
    }
  }, [color, size]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: size,
        height: Math.ceil((GRID_ROWS / GRID_COLS) * size),
        imageRendering: 'pixelated',
        flexShrink: 0,
      }}
    />
  );
}
