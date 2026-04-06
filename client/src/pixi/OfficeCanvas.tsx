import { useRef, useCallback, useMemo } from 'react';
import { StableApplication } from './StableApplication';
import { Graphics as PixiGraphics } from 'pixi.js';
import './setup';
import { CANVAS_WIDTH, CANVAS_HEIGHT, DESK_POSITIONS, AGENT_COLORS } from '../types';
import type { AgentInfo } from '../types';
import { TilemapLayer } from './TilemapLayer';
import { UserSprite } from './UserSprite';
import { AgentSprite } from './AgentSprite';
import { SubAgentSprite } from './SubAgentSprite';
import { AmbientParticles } from './effects/AmbientParticles';

interface OfficeCanvasProps {
  agents: Map<string, AgentInfo>;
  selectedAgentId: string | null;
  onAgentClick: (agentId: string) => void;
  onEmptyClick: () => void;
}

export function OfficeCanvas({ agents, selectedAgentId, onAgentClick, onEmptyClick }: OfficeCanvasProps) {
  // Flag to suppress wrapper click when a Pixi agent was clicked
  const agentClickedRef = useRef(false);

  const handleAgentClick = useCallback((agentId: string) => {
    agentClickedRef.current = true;
    onAgentClick(agentId);
  }, [onAgentClick]);

  const handleWrapperClick = useCallback(() => {
    if (agentClickedRef.current) {
      agentClickedRef.current = false;
      return;
    }
    onEmptyClick();
  }, [onEmptyClick]);

  // Build a stable key from sub-agent IDs to avoid recalculating on every agents update
  const subAgentKey = useMemo(() => {
    const ids: string[] = [];
    agents.forEach((agent) => {
      (agent.subAgents ?? []).forEach((s) => ids.push(s.id));
    });
    return ids.join(',');
  }, [agents]);

  // Collect all sub-agents — only recalculates when sub-agent list actually changes
  const allSubAgents = useMemo(() => {
    const subs: { sub: NonNullable<AgentInfo['subAgents']>[0]; parentDesk: { x: number; y: number }; parentColor: string; index: number }[] = [];
    agents.forEach((agent) => {
      if (!agent.subAgents?.length) return;
      const desk = DESK_POSITIONS[agent.deskIndex] ?? DESK_POSITIONS[0];
      const color = agent.color || AGENT_COLORS[agent.deskIndex % AGENT_COLORS.length];
      agent.subAgents.forEach((sub, idx) => {
        subs.push({ sub, parentDesk: desk, parentColor: color, index: idx });
      });
    });
    return subs;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subAgentKey]);

  // Vignette / border overlay for depth
  const drawOverlay = useCallback((g: PixiGraphics) => {
    g.clear();
    const w = CANVAS_WIDTH;
    const h = CANVAS_HEIGHT;

    // Top edge shadow
    g.rect(0, 0, w, 8);
    g.fill({ color: 0x000000, alpha: 0.04 });
    g.rect(0, 0, w, 3);
    g.fill({ color: 0x000000, alpha: 0.03 });

    // Bottom edge shadow
    g.rect(0, h - 8, w, 8);
    g.fill({ color: 0x000000, alpha: 0.04 });

    // Left edge
    g.rect(0, 0, 3, h);
    g.fill({ color: 0x000000, alpha: 0.03 });

    // Right edge
    g.rect(w - 3, 0, 3, h);
    g.fill({ color: 0x000000, alpha: 0.03 });
  }, []);

  return (
    <div className="office-canvas-wrapper" onClick={handleWrapperClick}>
      <StableApplication
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        background={0x1a1a2e}
        antialias
        resolution={window.devicePixelRatio || 2}
        autoDensity
        className="office-canvas"
      >
        {/* Layer 0: Tiles */}
        <pixiContainer>
          <TilemapLayer />
        </pixiContainer>

        {/* Layer 1: User */}
        <pixiContainer>
          <UserSprite />
        </pixiContainer>

        {/* Layer 2: Agents + Sub-agents */}
        <pixiContainer sortableChildren>
          {Array.from(agents.values()).map((agent) => (
            <AgentSprite
              key={agent.id}
              agent={agent}
              isSelected={agent.id === selectedAgentId}
              onClick={() => handleAgentClick(agent.id)}
            />
          ))}
          {allSubAgents.map(({ sub, parentDesk, parentColor, index }) => (
            <SubAgentSprite
              key={sub.id}
              sub={sub}
              parentDesk={parentDesk}
              index={index}
              parentColor={parentColor}
            />
          ))}
        </pixiContainer>

        {/* Layer 3: Particles */}
        <pixiContainer>
          <AmbientParticles />
        </pixiContainer>

        {/* Layer 4: Vignette overlay */}
        <pixiGraphics draw={drawOverlay} />
      </StableApplication>
    </div>
  );
}
