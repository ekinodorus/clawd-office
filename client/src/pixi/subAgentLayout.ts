import type { Position } from '../types';
import { PIXEL_TILE_SIZE } from '../types';

const S = PIXEL_TILE_SIZE;

// Direction offsets: left, right, up, down
const DIR_OFFSETS: Position[] = [
  { x: -1, y: 0 },  // left
  { x: 1, y: 0 },   // right
  { x: 0, y: -1 },  // up
  { x: 0, y: 1 },   // down
];

/**
 * Calculate pixel position for a sub-agent relative to parent desk.
 * First 4: 1.5 tiles away in 4 cardinal directions.
 * 5+: 2.5 tiles away (second ring).
 */
export function getSubAgentPosition(parentDesk: Position, index: number): { x: number; y: number } {
  const ring = Math.floor(index / 4);
  const dir = index % 4;
  const distance = ring === 0 ? 1.5 : 2.5;
  const offset = DIR_OFFSETS[dir];

  const cx = parentDesk.x * S + S / 2;
  const cy = (parentDesk.y - 1) * S + S / 2;

  return {
    x: cx + offset.x * distance * S,
    y: cy + offset.y * distance * S,
  };
}
