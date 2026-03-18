import { describe, it, expect } from 'vitest';
import {
  DESK_POSITIONS,
  AGENT_COLORS,
  STATE_LABELS,
  STATE_ICONS,
  STATE_COLORS,
  MAP_COLS,
  MAP_ROWS,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  PIXEL_TILE_SIZE,
  USER_DESK,
  MEETING_ROOM,
  DANGEROUS_TOOLS,
  PERMISSION_MODES,
} from '../types';
import type { AgentState } from '../types';

const ALL_STATES: AgentState[] = [
  'coding', 'running_command', 'searching', 'planning',
  'waiting_for_user', 'thinking', 'idle', 'error',
];

describe('constants', () => {
  it('CANVAS_WIDTH equals MAP_COLS * PIXEL_TILE_SIZE', () => {
    expect(CANVAS_WIDTH).toBe(MAP_COLS * PIXEL_TILE_SIZE);
  });

  it('CANVAS_HEIGHT equals MAP_ROWS * PIXEL_TILE_SIZE', () => {
    expect(CANVAS_HEIGHT).toBe(MAP_ROWS * PIXEL_TILE_SIZE);
  });

  it('DESK_POSITIONS has at least 1 position', () => {
    expect(DESK_POSITIONS.length).toBeGreaterThan(0);
  });

  it('AGENT_COLORS has at least 1 color', () => {
    expect(AGENT_COLORS.length).toBeGreaterThan(0);
  });

  it('all AGENT_COLORS are valid hex strings', () => {
    for (const c of AGENT_COLORS) {
      expect(c).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });
});

describe('state mappings', () => {
  it('STATE_LABELS covers all states', () => {
    for (const s of ALL_STATES) {
      expect(STATE_LABELS[s]).toBeDefined();
    }
  });

  it('STATE_ICONS covers all states', () => {
    for (const s of ALL_STATES) {
      expect(STATE_ICONS[s]).toBeDefined();
    }
  });

  it('STATE_COLORS covers all states', () => {
    for (const s of ALL_STATES) {
      expect(STATE_COLORS[s]).toBeDefined();
    }
  });

  it('STATE_COLORS are valid hex strings', () => {
    for (const s of ALL_STATES) {
      expect(STATE_COLORS[s]).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it('STATE_LABELS are non-empty strings', () => {
    for (const s of ALL_STATES) {
      expect(STATE_LABELS[s].length).toBeGreaterThan(0);
    }
  });
});

describe('desk and map constants', () => {
  it('DESK_POSITIONS has exactly 5 positions', () => {
    expect(DESK_POSITIONS.length).toBe(5);
  });

  it('all DESK_POSITIONS are within map bounds', () => {
    for (const pos of DESK_POSITIONS) {
      expect(pos.x).toBeGreaterThanOrEqual(0);
      expect(pos.x).toBeLessThan(MAP_COLS);
      expect(pos.y).toBeGreaterThanOrEqual(0);
      expect(pos.y).toBeLessThan(MAP_ROWS);
    }
  });

  it('USER_DESK is within map bounds', () => {
    expect(USER_DESK.x).toBeGreaterThanOrEqual(0);
    expect(USER_DESK.x).toBeLessThan(MAP_COLS);
    expect(USER_DESK.y).toBeGreaterThanOrEqual(0);
    expect(USER_DESK.y).toBeLessThan(MAP_ROWS);
  });

  it('MEETING_ROOM is within map bounds', () => {
    expect(MEETING_ROOM.x).toBeGreaterThanOrEqual(0);
    expect(MEETING_ROOM.x).toBeLessThan(MAP_COLS);
    expect(MEETING_ROOM.y).toBeGreaterThanOrEqual(0);
    expect(MEETING_ROOM.y).toBeLessThan(MAP_ROWS);
  });

  it('PIXEL_TILE_SIZE is a positive integer', () => {
    expect(PIXEL_TILE_SIZE).toBeGreaterThan(0);
    expect(Number.isInteger(PIXEL_TILE_SIZE)).toBe(true);
  });
});

describe('DANGEROUS_TOOLS', () => {
  it('contains Bash, Edit, Write', () => {
    expect(DANGEROUS_TOOLS).toContain('Bash');
    expect(DANGEROUS_TOOLS).toContain('Edit');
    expect(DANGEROUS_TOOLS).toContain('Write');
  });

  it('has exactly 3 entries', () => {
    expect(DANGEROUS_TOOLS.length).toBe(3);
  });
});

describe('PERMISSION_MODES', () => {
  it('has default, acceptEdits, and plan modes', () => {
    const values = PERMISSION_MODES.map((m) => m.value);
    expect(values).toContain('default');
    expect(values).toContain('acceptEdits');
    expect(values).toContain('plan');
  });

  it('each mode has a non-empty label', () => {
    for (const mode of PERMISSION_MODES) {
      expect(mode.label.length).toBeGreaterThan(0);
    }
  });

  it('has exactly 3 modes', () => {
    expect(PERMISSION_MODES.length).toBe(3);
  });
});
