import { describe, it, expect } from 'vitest';
import { getSubAgentPosition } from '../pixi/subAgentLayout';
import { PIXEL_TILE_SIZE } from '../types';

const S = PIXEL_TILE_SIZE;

describe('getSubAgentPosition', () => {
  const parentDesk = { x: 10, y: 10 };

  it('places sub0 to the left of parent', () => {
    const pos = getSubAgentPosition(parentDesk, 0);
    expect(pos.x).toBeLessThan(parentDesk.x * S);
  });

  it('places sub1 to the right of parent', () => {
    const pos = getSubAgentPosition(parentDesk, 1);
    expect(pos.x).toBeGreaterThan(parentDesk.x * S);
  });

  it('places sub2 above parent', () => {
    const pos = getSubAgentPosition(parentDesk, 2);
    expect(pos.y).toBeLessThan(parentDesk.y * S);
  });

  it('places sub3 below parent', () => {
    const pos = getSubAgentPosition(parentDesk, 3);
    expect(pos.y).toBeGreaterThan(parentDesk.y * S);
  });

  it('first 4 subs are 1.5 tiles away from parent', () => {
    for (let i = 0; i < 4; i++) {
      const pos = getSubAgentPosition(parentDesk, i);
      const px = parentDesk.x * S + S / 2;
      const py = (parentDesk.y - 1) * S + S / 2;
      const dist = Math.sqrt((pos.x - px) ** 2 + (pos.y - py) ** 2);
      expect(dist).toBeCloseTo(1.5 * S, 0);
    }
  });

  it('5th+ subs use 2-tile distance (second ring)', () => {
    const pos = getSubAgentPosition(parentDesk, 4);
    const px = parentDesk.x * S + S / 2;
    const py = (parentDesk.y - 1) * S + S / 2;
    const dist = Math.sqrt((pos.x - px) ** 2 + (pos.y - py) ** 2);
    expect(dist).toBeCloseTo(2.5 * S, 0);
  });

  it('all 8 subs in second ring use 2.5-tile distance', () => {
    for (let i = 4; i < 8; i++) {
      const pos = getSubAgentPosition(parentDesk, i);
      const px = parentDesk.x * S + S / 2;
      const py = (parentDesk.y - 1) * S + S / 2;
      const dist = Math.sqrt((pos.x - px) ** 2 + (pos.y - py) ** 2);
      expect(dist).toBeCloseTo(2.5 * S, 0);
    }
  });

  it('second ring directions repeat (left, right, up, down)', () => {
    // index 4 should be left (same direction as index 0)
    const pos0 = getSubAgentPosition(parentDesk, 0);
    const pos4 = getSubAgentPosition(parentDesk, 4);
    const cx = parentDesk.x * S + S / 2;
    // Both should be to the left of center
    expect(pos0.x).toBeLessThan(cx);
    expect(pos4.x).toBeLessThan(cx);
  });

  it('returns consistent results for same inputs', () => {
    const a = getSubAgentPosition(parentDesk, 2);
    const b = getSubAgentPosition(parentDesk, 2);
    expect(a.x).toBe(b.x);
    expect(a.y).toBe(b.y);
  });

  it('works with parent desk at origin (0, 0)', () => {
    const origin = { x: 0, y: 0 };
    const pos = getSubAgentPosition(origin, 0);
    // Should not throw, position should be a valid number
    expect(Number.isFinite(pos.x)).toBe(true);
    expect(Number.isFinite(pos.y)).toBe(true);
  });

  it('centers on parent pixel position correctly', () => {
    const pos = getSubAgentPosition(parentDesk, 1); // right
    const cx = parentDesk.x * S + S / 2;
    const cy = (parentDesk.y - 1) * S + S / 2;
    // sub1 is to the right, so y should match center
    expect(pos.y).toBe(cy);
    // x should be offset to the right
    expect(pos.x).toBe(cx + 1.5 * S);
  });
});
