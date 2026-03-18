import { useCallback } from 'react';
import { Graphics as PixiGraphics } from 'pixi.js';
import { MAP_COLS, MAP_ROWS, PIXEL_TILE_SIZE } from '../types';

type TileType = 'wall' | 'floor';

function getTileType(col: number, row: number): TileType {
  if (row === 0 || row === MAP_ROWS - 1) return 'wall';
  if (col === 0 || col === MAP_COLS - 1) return 'wall';
  return 'floor';
}

// Deterministic hash for per-tile variation
function tileHash(col: number, row: number): number {
  let h = col * 374761393 + row * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967296;
}

const S = PIXEL_TILE_SIZE;

// Cave palette
const WALL_BASE = 0x3a3a4a;
const WALL_LIGHT = 0x525268;
const WALL_DARK = 0x24242e;
const FLOOR_BASE = 0x4a4438;
const FLOOR_LIGHT = 0x5e5848;
const FLOOR_DARK = 0x38322a;

export function TilemapLayer() {
  const draw = useCallback((g: PixiGraphics) => {
    g.clear();

    for (let row = 0; row < MAP_ROWS; row++) {
      for (let col = 0; col < MAP_COLS; col++) {
        const type = getTileType(col, row);
        const x = col * S;
        const y = row * S;
        const isWall = type === 'wall';

        const base = isWall ? WALL_BASE : FLOOR_BASE;
        const light = isWall ? WALL_LIGHT : FLOOR_LIGHT;
        const dark = isWall ? WALL_DARK : FLOOR_DARK;

        // Base fill
        g.rect(x, y, S, S);
        g.fill(base);

        // Per-tile variation (cave dirt/rock unevenness)
        const v = tileHash(col, row);
        if (v > 0.5) {
          g.rect(x, y, S, S);
          g.fill({ color: 0xffffff, alpha: (v - 0.5) * 0.1 });
        } else {
          g.rect(x, y, S, S);
          g.fill({ color: 0x000000, alpha: (0.5 - v) * 0.1 });
        }

        // Top-left highlight
        g.rect(x, y, S, 2);
        g.fill({ color: light, alpha: 0.7 });
        g.rect(x, y, 2, S);
        g.fill({ color: light, alpha: 0.5 });

        // Bottom-right shadow
        g.rect(x, y + S - 2, S, 2);
        g.fill({ color: dark, alpha: 0.7 });
        g.rect(x + S - 2, y, 2, S);
        g.fill({ color: dark, alpha: 0.5 });

        // Wall: rough stone block pattern
        if (isWall) {
          const blockH = Math.floor(S / 2);
          for (let bRow = 0; bRow < 2; bRow++) {
            const by = y + bRow * blockH;
            const offset = bRow % 2 === 0 ? 0 : Math.floor(S * 0.4);

            // Mortar lines (dark cracks)
            g.rect(x, by + blockH - 1, S, 2);
            g.fill({ color: 0x1a1a22, alpha: 0.5 });

            g.rect(x + offset, by, 2, blockH);
            g.fill({ color: 0x1a1a22, alpha: 0.4 });
            const mid = offset + Math.floor(S * 0.55);
            if (mid < S) {
              g.rect(x + mid, by, 2, blockH);
              g.fill({ color: 0x1a1a22, alpha: 0.4 });
            }
          }

          // Random cracks/texture on some wall tiles
          const crack = tileHash(col * 7, row * 3);
          if (crack > 0.7) {
            g.rect(x + S * 0.3, y + S * 0.2, 1, S * 0.3);
            g.fill({ color: 0x1a1a22, alpha: 0.25 });
          }
          if (crack < 0.2) {
            g.rect(x + S * 0.6, y + S * 0.5, S * 0.2, 1);
            g.fill({ color: 0x1a1a22, alpha: 0.2 });
          }
        }

        // Floor: scattered pebbles/dirt spots
        if (!isWall) {
          const p1 = tileHash(col + 100, row + 200);
          if (p1 > 0.75) {
            g.circle(x + S * 0.3, y + S * 0.6, 1.5);
            g.fill({ color: 0x000000, alpha: 0.08 });
          }
          const p2 = tileHash(col + 300, row + 400);
          if (p2 > 0.8) {
            g.circle(x + S * 0.7, y + S * 0.3, 1);
            g.fill({ color: 0xffffff, alpha: 0.06 });
          }
        }
      }
    }

    // Inner wall shadow (cast onto floor from walls)
    for (let col = 1; col < MAP_COLS - 1; col++) {
      // Top wall casts shadow down
      g.rect(col * S, 1 * S, S, 4);
      g.fill({ color: 0x000000, alpha: 0.15 });
      // Bottom wall casts shadow up
      g.rect(col * S, (MAP_ROWS - 2) * S + S - 4, S, 4);
      g.fill({ color: 0x000000, alpha: 0.08 });
    }
    for (let row = 1; row < MAP_ROWS - 1; row++) {
      // Left wall casts shadow right
      g.rect(1 * S, row * S, 4, S);
      g.fill({ color: 0x000000, alpha: 0.12 });
      // Right wall casts shadow left
      g.rect((MAP_COLS - 2) * S + S - 4, row * S, 4, S);
      g.fill({ color: 0x000000, alpha: 0.06 });
    }
  }, []);

  return <pixiGraphics draw={draw} />;
}
