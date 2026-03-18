// Agent states derived from SDK message analysis
export type AgentState =
  | 'coding'
  | 'running_command'
  | 'searching'
  | 'planning'
  | 'waiting_for_user'
  | 'thinking'
  | 'idle'
  | 'error';

export interface Position {
  x: number;
  y: number;
}

export interface ConversationEntry {
  timestamp: number;
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: string;
  toolName?: string;
}

export interface SubAgentInfo {
  id: string;
  name: string;
  description: string;
  parentId: string;
}

export interface AgentInfo {
  id: string;
  name: string;
  state: AgentState;
  currentAction: string;
  deskIndex: number;
  color?: string;
  conversationLog: ConversationEntry[];
  error?: string;
  workDirectory?: string;
  gitBranch?: string;
  subAgents?: SubAgentInfo[];
  permissionMode?: string;
  allowedTools?: string[];
  queueSize?: number;
}

export const DANGEROUS_TOOLS = ['Bash', 'Edit', 'Write'] as const;

export const PERMISSION_MODES = [
  { value: 'default', label: 'Default' },
  { value: 'acceptEdits', label: 'Accept Edits' },
  { value: 'plan', label: 'Plan' },
] as const;

export interface AskUserQuestionOption {
  label: string;
  description?: string;
}

export interface AskUserQuestion {
  question: string;
  header?: string;
  options: AskUserQuestionOption[];
  multiSelect?: boolean;
}

export interface PermissionRequest {
  requestId: string;
  agentId: string;
  type: 'ask_user_question' | 'tool_confirm' | 'plan_confirm';
  toolName: string;
  toolInput: Record<string, unknown>;
}

export interface SkillInfo {
  name: string;
  description: string;
  argumentHint: string;
}

export interface AddAgentConfig {
  name: string;
  prompt?: string;
  workDirectory?: string;
  color?: string;
}

// Office map constants
export const MAP_COLS = 32;
export const MAP_ROWS = 24;

// PixiJS pixel constants
export const PIXEL_TILE_SIZE = 32;
export const CANVAS_WIDTH = MAP_COLS * PIXEL_TILE_SIZE;  // 1024
export const CANVAS_HEIGHT = MAP_ROWS * PIXEL_TILE_SIZE; // 768

// Character home positions (in tile coordinates, spread across cave)
export const DESK_POSITIONS: Position[] = [
  { x: 6, y: 6 },
  { x: 16, y: 5 },
  { x: 25, y: 7 },
  { x: 8, y: 16 },
  { x: 22, y: 17 },
];

export const USER_DESK: Position = { x: 15, y: 12 };
export const MEETING_ROOM: Position = { x: 10, y: 10 };

// Colors for agent characters
export const AGENT_COLORS = [
  '#5b6ee1', // Blue
  '#d95763', // Red
  '#99e550', // Green
  '#fbf236', // Yellow
  '#6abe30', // Dark Green
  '#37946e', // Teal
  '#76428a', // Purple
  '#ac3232', // Dark Red
  '#3f3f74', // Dark Blue
  '#d77bba', // Pink
];

// State display info
export const STATE_LABELS: Record<AgentState, string> = {
  coding: 'Coding',
  running_command: 'Running',
  searching: 'Searching',
  planning: 'Planning',
  waiting_for_user: 'Waiting',
  thinking: 'Thinking',
  idle: 'Idle',
  error: 'Error',
};

export const STATE_ICONS: Record<AgentState, string> = {
  coding: '',
  running_command: '',
  searching: '',
  planning: '',
  waiting_for_user: '',
  thinking: '',
  idle: '',
  error: '',
};

export const STATE_COLORS: Record<AgentState, string> = {
  coding: '#5b6ee1',
  running_command: '#d95763',
  searching: '#99e550',
  planning: '#fbf236',
  waiting_for_user: '#ff9933',
  thinking: '#76428a',
  idle: '#696a6a',
  error: '#d95763',
};
