import type { AgentInfo } from '../types';
import { STATE_LABELS, STATE_COLORS } from '../types';
import { CrabIcon } from './CrabIcon';
import '../styles/ui.css';

interface AgentStatusBarProps {
  agents: Map<string, AgentInfo>;
  selectedAgentId: string | null;
  onAgentClick: (agentId: string) => void;
  onAddAgent: () => void;
}

export function AgentStatusBar({ agents, selectedAgentId, onAgentClick, onAddAgent }: AgentStatusBarProps) {
  return (
    <div className="status-bar">
      <div className="status-bar__logo">
        clawd<span>-office</span>
      </div>
      <div className="status-bar__badges">
        {Array.from(agents.values()).map((agent) => {
          const color = STATE_COLORS[agent.state];
          const label = STATE_LABELS[agent.state];
          const isActive = agent.state !== 'idle' && agent.state !== 'error';
          const isSelected = agent.id === selectedAgentId;
          return (
            <div
              key={agent.id}
              className={`status-bar__badge ${isSelected ? 'status-bar__badge--active' : ''}`}
              onClick={() => onAgentClick(agent.id)}
            >
              <CrabIcon color={agent.color || '#5b6ee1'} size={20} />
              <div className="status-bar__info">
                <span className="status-bar__name">{agent.name}</span>
                <span className="status-bar__action">
                  {agent.currentAction || label}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <button className="status-bar__add" onClick={onAddAgent}>
        + Add Agent
      </button>
    </div>
  );
}
