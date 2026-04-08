import { useRef, useCallback, useState, useEffect } from 'react';
import { useTick } from '@pixi/react';
import { Container, Graphics as PixiGraphics } from 'pixi.js';
import { PIXEL_TILE_SIZE, MAP_COLS, MAP_ROWS, USER_DESK } from '../types';
import type { AgentInfo } from '../types';
import { BUDDY_BODIES, BUDDY_RARITIES, type BuddySpecies, type BuddyRarity } from './buddySprites';

const S = PIXEL_TILE_SIZE;
const MOVE_SPEED = 0.35;
const MAX_SPEECH_WIDTH = 36; // chars per line in bubble

// --- Speech generation from agent context ---

const IDLE_LINES = ['...zzz', '...',  '( -_- )'];

/** Extract a contextual comment from recent agent activity. */
function generateSpeech(agents: AgentInfo[]): string | null {
  const active = agents.filter((a) => a.state !== 'idle');
  if (active.length === 0) {
    // Rarely mutter when idle
    if (Math.random() < 0.25) return pickRandom(IDLE_LINES);
    return null;
  }

  const agent = pickRandom(active);
  const tag = agents.length > 1 ? `[${agent.name}] ` : '';

  // Try to pull from recent conversation
  const recent = agent.conversationLog.slice(-8);
  const assistantMsgs = recent.filter((e) => e.role === 'assistant' && e.content.length > 10);
  const toolMsgs = recent.filter((e) => e.role === 'tool' && e.content.length > 5);

  const r = Math.random();

  // 40%: quote/react to assistant content
  if (r < 0.4 && assistantMsgs.length > 0) {
    const msg = assistantMsgs[assistantMsgs.length - 1];
    return tag + reactToContent(msg.content);
  }

  // 25%: comment on tool usage
  if (r < 0.65 && toolMsgs.length > 0) {
    const msg = toolMsgs[toolMsgs.length - 1];
    return tag + reactToTool(msg.toolName ?? '', msg.content);
  }

  // 20%: comment on currentAction
  if (r < 0.85 && agent.currentAction) {
    return tag + reactToAction(agent.currentAction);
  }

  // 15%: generic state comment
  return tag + genericStateComment(agent.state);
}

function reactToContent(content: string): string {
  // Grab a meaningful snippet from assistant text
  const sentences = content
    .replace(/```[\s\S]*?```/g, '') // strip code blocks
    .replace(/\n+/g, ' ')
    .split(/[.!?]\s+/)
    .filter((s) => s.length > 8 && s.length < 80);

  if (sentences.length > 0) {
    const sentence = pickRandom(sentences).trim();
    const truncated = sentence.length > 60 ? sentence.slice(0, 57) + '...' : sentence;
    // Wrap in quotes or add a reaction prefix
    const prefixes = ['"', '*reads* ', '*nods* ', '...', '*peeks* '];
    const prefix = pickRandom(prefixes);
    if (prefix === '"') return `"${truncated}"`;
    return `${prefix}${truncated}`;
  }

  return pickRandom(['*reading...*', '*watching closely*', 'hmm, interesting...']);
}

function reactToTool(toolName: string, content: string): string {
  const t = toolName.toLowerCase();
  if (t.includes('bash') || t.includes('command')) {
    const cmd = content.slice(0, 40).split('\n')[0];
    return pickRandom([
      `*watches* ${cmd}`,
      `running ${cmd}...`,
      '*peeks at terminal*',
    ]);
  }
  if (t.includes('read')) {
    const file = content.match(/([^\s/]+\.\w+)/)?.[1];
    return file
      ? pickRandom([`*peeks at ${file}*`, `reading ${file}...`])
      : '*reading along*';
  }
  if (t.includes('edit') || t.includes('write')) {
    return pickRandom([
      '*watches edits*',
      'changing code...',
      '*taking notes*',
    ]);
  }
  if (t.includes('grep') || t.includes('glob') || t.includes('search')) {
    return pickRandom([
      '*searching too*',
      'where is it...',
      '*looks around*',
    ]);
  }
  return pickRandom(['*observing*', '*watching*', 'interesting...']);
}

function reactToAction(action: string): string {
  const a = action.toLowerCase();
  if (a.includes('read')) return '*reading along*';
  if (a.includes('edit') || a.includes('writ')) return '*watches the changes*';
  if (a.includes('search') || a.includes('grep')) return 'where could it be...';
  if (a.includes('bash') || a.includes('run') || a.includes('command')) return '*watches terminal*';
  if (a.includes('think')) return '*thinking too*';
  // Truncate and quote
  const short = action.length > 45 ? action.slice(0, 42) + '...' : action;
  return `*${short}*`;
}

function genericStateComment(state: string): string {
  const lines: Record<string, string[]> = {
    coding:          ['*watching code flow*', 'nice architecture', 'keep going...'],
    running_command: ['*stares at terminal*', 'what will happen...', 'brrr...'],
    searching:       ['*helps look*', 'must be somewhere...', '*searching*'],
    thinking:        ['*thinking too...*', 'hmm...', 'take your time'],
    planning:        ['a plan emerges...', '*nods approvingly*', 'good thinking'],
    waiting_for_user:['waiting...', 'your turn!', '*looks expectantly*'],
    error:           ['oh no...', '*worried*', 'that does not look right'],
  };
  return pickRandom(lines[state] ?? ['*watching*']);
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Wrap text to fit in bubble. */
function wrapText(text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if (current.length + word.length + 1 > maxWidth && current.length > 0) {
      lines.push(current);
      current = word;
    } else {
      current = current ? `${current} ${word}` : word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

// --- Component ---

interface UserSpriteProps {
  species?: BuddySpecies;
  rarity?: BuddyRarity;
  agents?: AgentInfo[];
}

export function UserSprite({ species = 'snail', rarity = 'uncommon', agents = [] }: UserSpriteProps) {
  const containerRef = useRef<Container>(null);
  const bodyContainerRef = useRef<Container>(null);

  const wanderTarget = useRef<{ x: number; y: number } | null>(null);
  const wanderTimer = useRef(2 + Math.random() * 3);

  const homeX = USER_DESK.x * S + S / 2;
  const homeY = (USER_DESK.y - 1) * S + S / 2;

  // Animation frame
  const [frameIdx, setFrameIdx] = useState(0);
  const frames = BUDDY_BODIES[species];

  useEffect(() => {
    const interval = setInterval(() => {
      setFrameIdx((prev) => (prev + 1) % frames.length);
    }, 500);
    return () => clearInterval(interval);
  }, [frames.length]);

  // Speech bubble state
  const [speech, setSpeech] = useState<string | null>(null);
  const speechTimer = useRef(5 + Math.random() * 8);
  const agentsRef = useRef(agents);
  agentsRef.current = agents;
  const lastLogLen = useRef(0);

  useEffect(() => {
    const interval = setInterval(() => {
      speechTimer.current -= 1;
      if (speechTimer.current <= 0) {
        const currentAgents = agentsRef.current;
        const hasActive = currentAgents.some((a) => a.state !== 'idle');

        // Also trigger on new conversation entries
        const totalLog = currentAgents.reduce((sum, a) => sum + a.conversationLog.length, 0);
        const logChanged = totalLog !== lastLogLen.current;
        lastLogLen.current = totalLog;

        const line = generateSpeech(currentAgents);
        if (line) {
          setSpeech(line);
          setTimeout(() => setSpeech(null), 4000);
        }

        speechTimer.current = hasActive
          ? 10 + Math.random() * 15
          : 30 + Math.random() * 40;
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

  const spriteText = frames[frameIdx].join('\n');
  const rarityColor = BUDDY_RARITIES.find((r) => r.name === rarity)?.hex ?? 0x50c878;

  // Wrap speech for multi-line bubble
  const speechLines = speech ? wrapText(speech, MAX_SPEECH_WIDTH) : [];
  const speechDisplay = speechLines.join('\n');
  const maxLineLen = speechLines.reduce((max, l) => Math.max(max, l.length), 0);

  const drawShadow = useCallback((g: PixiGraphics) => {
    g.clear();
    g.ellipse(0, 22, 18, 2.5);
    g.fill({ color: 0x000000, alpha: 0.15 });
  }, []);

  const drawBubble = useCallback((g: PixiGraphics) => {
    g.clear();
    if (!speech) return;
    const charW = 5.2;
    const lineH = 11;
    const padX = 10;
    const padY = 6;
    const w = maxLineLen * charW + padX * 2;
    const h = speechLines.length * lineH + padY * 2;
    const bx = -w - 10;
    const by = -h / 2 - 10;
    // Background
    g.roundRect(bx, by, w, h, 3);
    g.fill({ color: 0x101018, alpha: 0.92 });
    g.roundRect(bx, by, w, h, 3);
    g.stroke({ color: 0x40d870, width: 1 });
    // Tail pointing right
    g.moveTo(bx + w, by + h / 2 - 3);
    g.lineTo(bx + w + 6, by + h / 2);
    g.lineTo(bx + w, by + h / 2 + 3);
    g.fill({ color: 0x101018, alpha: 0.92 });
  }, [speech, maxLineLen, speechLines.length]);

  return (
    <pixiContainer ref={containerRef} x={homeX} y={homeY}>
      <pixiGraphics draw={drawShadow} />

      <pixiContainer ref={bodyContainerRef}>
        <pixiText
          text={spriteText}
          anchor={{ x: 0.5, y: 0.5 }}
          style={{
            fontSize: 8,
            fontFamily: "'Menlo', 'Courier New', monospace",
            fontWeight: '700',
            fill: rarityColor,
            letterSpacing: 0.5,
            lineHeight: 9,
          }}
        />
      </pixiContainer>

      <pixiText
        text={species.charAt(0).toUpperCase() + species.slice(1)}
        x={0}
        y={26}
        anchor={{ x: 0.5, y: 0 }}
        style={{
          fontSize: 9,
          fontWeight: '700',
          fill: rarityColor,
          fontFamily: "'Courier New', monospace",
          letterSpacing: 1.5,
          stroke: { color: 0x000000, width: 3 },
        }}
      />

      {speech && (
        <>
          <pixiGraphics draw={drawBubble} />
          <pixiText
            text={speechDisplay}
            x={-(maxLineLen * 5.2 + 20) / 2 - 10}
            y={-10}
            anchor={{ x: 0.5, y: 0.5 }}
            style={{
              fontSize: 9,
              fontWeight: '600',
              fill: 0xc8c8e0,
              fontFamily: "'Courier New', monospace",
              lineHeight: 11,
            }}
          />
        </>
      )}
    </pixiContainer>
  );
}
