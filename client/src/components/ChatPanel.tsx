import { useState, useEffect, useRef, useCallback } from 'react';
import type { AgentInfo, ConversationEntry, PermissionRequest, AskUserQuestion, SkillInfo } from '../types';
import { STATE_LABELS, AGENT_COLORS, PERMISSION_MODES } from '../types';
import { PromptInput } from './PromptInput';
import { CrabIcon } from './CrabIcon';

const ROLE_COLORS: Record<string, string> = {
  user: '#3fb950',
  assistant: '#58a6ff',
  tool: '#d2a8ff',
  system: '#8b949e',
};

const DEFAULT_ROLE_LABELS: Record<string, string> = {
  user: 'Knurl',
  assistant: 'AI',
  tool: 'TOOL',
  system: 'SYS',
};

const COLLAPSE_LENGTH = 600;

const PATH_REGEX = /(\/[\w./-]+(?:\.\w+)?)/g;

function openPath(filePath: string) {
  fetch('/api/open-path', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: filePath }),
  }).catch(() => {});
}

function renderWithLinks(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const regex = new RegExp(PATH_REGEX);
  while ((match = regex.exec(text)) !== null) {
    const path = match[1];
    // Only linkify paths that look like absolute paths with at least 2 segments
    if (path.split('/').filter(Boolean).length < 2) continue;
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push(
      <span
        key={match.index}
        className="chat-panel__file-link"
        onClick={() => openPath(path)}
        title={`Open ${path}`}
      >
        {path}
      </span>
    );
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts.length > 0 ? parts : [text];
}

function EntryItem({ entry, agentName, buddyName }: { entry: ConversationEntry; agentName?: string; buddyName?: string }) {
  const [expanded, setExpanded] = useState(false);
  const d = new Date(entry.timestamp);
  const ts = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const roleLabels: Record<string, string> = { ...DEFAULT_ROLE_LABELS, ...(buddyName ? { user: buddyName } : {}) };
  const label = entry.toolName
    ? entry.toolName
    : entry.role === 'assistant' && agentName
      ? agentName
      : roleLabels[entry.role] || entry.role.toUpperCase();
  const roleColor = ROLE_COLORS[entry.role] || '#8b949e';

  const isLong = entry.content.length > COLLAPSE_LENGTH;
  const displayText = isLong && !expanded
    ? entry.content.slice(0, COLLAPSE_LENGTH) + '...'
    : entry.content;

  const toggle = useCallback(() => setExpanded((v) => !v), []);

  return (
    <div className="chat-panel__entry">
      <div className="chat-panel__entry-header">
        <span className="chat-panel__role" style={{ color: roleColor }}>
          {label}
        </span>
        <span className="chat-panel__timestamp">{ts}</span>
      </div>
      <div className="chat-panel__content">{renderWithLinks(displayText)}</div>
      {isLong && (
        <button className="chat-panel__expand" onClick={toggle}>
          {expanded ? 'Collapse' : 'Show more'}
        </button>
      )}
    </div>
  );
}

function QuestionCard({
  request,
  onRespond,
}: {
  request: PermissionRequest;
  onRespond: (requestId: string, agentId: string, type: string, answers: Record<string, string>) => void;
}) {
  const [selected, setSelected] = useState<Record<string, string>>({});
  const toolInput = request.toolInput;
  const questions = (toolInput.questions as AskUserQuestion[]) ?? [];

  const handleSelect = (qIdx: number, label: string) => {
    setSelected((prev) => ({ ...prev, [`q${qIdx}`]: label }));
  };

  const handleSubmit = () => {
    onRespond(request.requestId, request.agentId, request.type, selected);
  };

  const hasSelection = Object.keys(selected).length > 0;

  return (
    <div className="chat-panel__question-card">
      <div className="chat-panel__question-card-header">
        <span className="chat-panel__role" style={{ color: '#ff9933' }}>❓ QUESTION</span>
      </div>
      {questions.map((q, qIdx) => (
        <div key={qIdx} className="chat-panel__question-block">
          {q.header && <div className="chat-panel__question-header">{q.header}</div>}
          <div className="chat-panel__question-text">{q.question}</div>
          <div className="chat-panel__question-options">
            {q.options.map((opt, oIdx) => (
              <button
                key={oIdx}
                className={`chat-panel__question-option ${selected[`q${qIdx}`] === opt.label ? 'chat-panel__question-option--selected' : ''}`}
                onClick={() => handleSelect(qIdx, opt.label)}
              >
                <span className="chat-panel__question-option-label">{opt.label}</span>
                {opt.description && (
                  <span className="chat-panel__question-option-desc">{opt.description}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      ))}
      <button
        className="chat-panel__question-submit"
        onClick={handleSubmit}
        disabled={!hasSelection}
      >
        Answer
      </button>
    </div>
  );
}

function ToolConfirmCard({
  request,
  onRespond,
}: {
  request: PermissionRequest;
  onRespond: (requestId: string, agentId: string, type: string, answers: Record<string, string>) => void;
}) {
  const toolInput = request.toolInput;

  // Build a summary of the tool input
  let detail = '';
  if (request.toolName === 'Edit' || request.toolName === 'Write' || request.toolName === 'Read') {
    detail = (toolInput.file_path as string) ?? '';
  } else if (request.toolName === 'Bash') {
    detail = (toolInput.command as string) ?? '';
  } else if (request.toolName === 'Grep') {
    detail = (toolInput.pattern as string) ?? '';
  } else if (request.toolName === 'Glob') {
    detail = (toolInput.pattern as string) ?? '';
  }

  return (
    <div className="chat-panel__question-card">
      <div className="chat-panel__question-card-header">
        <span className="chat-panel__role" style={{ color: '#ff9933' }}>PERMISSION</span>
      </div>
      <div className="chat-panel__question-text">
        Allow <strong>{request.toolName}</strong>?
      </div>
      {detail && (
        <div className="chat-panel__tool-detail">{detail}</div>
      )}
      <div className="chat-panel__tool-confirm-actions">
        <button
          className="chat-panel__question-submit"
          onClick={() => onRespond(request.requestId, request.agentId, request.type, { allowed: 'true' })}
        >
          Allow
        </button>
        <button
          className="chat-panel__tool-deny"
          onClick={() => onRespond(request.requestId, request.agentId, request.type, { allowed: 'false' })}
        >
          Deny
        </button>
      </div>
    </div>
  );
}

interface ChatPanelProps {
  agent: AgentInfo | null;
  onSendPrompt: (agentId: string, prompt: string) => void;
  onRemoveAgent: (agentId: string) => void;
  onRenameAgent: (agentId: string, name: string) => void;
  onUpdateDirectory: (agentId: string, workDirectory: string | null) => void;
  onUpdateColor: (agentId: string, color: string) => void;
  onUpdatePermissionMode: (agentId: string, permissionMode: string) => void;
  onAbortAgent: (agentId: string) => void;
  permissionRequests: Map<string, PermissionRequest>;
  onRespondPermission: (requestId: string, agentId: string, type: string, answers: Record<string, string>) => void;
  onListSkills: (agentId: string) => Promise<{ skills: SkillInfo[] }>;
  onGetClaudeConfig: (agentId: string) => Promise<{ content: string | null }>;
  buddyName?: string;
}

export function ChatPanel({
  agent, onSendPrompt, onRemoveAgent, onRenameAgent, onUpdateDirectory, onUpdateColor,
  onUpdatePermissionMode, onAbortAgent, permissionRequests, onRespondPermission, onListSkills, onGetClaudeConfig,
  buddyName,
}: ChatPanelProps) {
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const nameInputRef = useRef<HTMLInputElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const isNearBottom = useRef(true);
  const prevAgentId = useRef<string | null>(null);

  const [promptPrefill, setPromptPrefill] = useState('');
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [modeSelectorOpen, setModeSelectorOpen] = useState(false);
  const [queuedPrompts, setQueuedPrompts] = useState<string[]>([]);

  // Reset state when agent changes
  useEffect(() => {
    if (agent?.id !== prevAgentId.current) {
      prevAgentId.current = agent?.id ?? null;
      setColorPickerOpen(false);
      setModeSelectorOpen(false);
      setQueuedPrompts([]);
    }
  }, [agent?.id]);

  // When a new user entry appears in conversationLog, remove matching queued prompt
  const userEntryCount = agent?.conversationLog.filter((e) => e.role === 'user').length ?? 0;
  const prevUserEntryCount = useRef(0);
  useEffect(() => {
    if (userEntryCount > prevUserEntryCount.current && queuedPrompts.length > 0) {
      setQueuedPrompts((prev) => prev.slice(1));
    }
    prevUserEntryCount.current = userEntryCount;
  }, [userEntryCount]);

  const startEditName = useCallback(() => {
    if (!agent) return;
    setNameValue(agent.name);
    setEditingName(true);
    setTimeout(() => nameInputRef.current?.select(), 0);
  }, [agent]);

  const commitName = useCallback(() => {
    if (!agent) return;
    const trimmed = nameValue.trim();
    if (trimmed && trimmed !== agent.name) {
      onRenameAgent(agent.id, trimmed);
    }
    setEditingName(false);
  }, [agent, nameValue, onRenameAgent]);

  const handleScroll = useCallback(() => {
    const el = logRef.current;
    if (!el) return;
    isNearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  }, []);

  useEffect(() => {
    if (logRef.current && isNearBottom.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [agent?.conversationLog.length, agent?.state, agent?.currentAction, permissionRequests.size]);

  const handleBrowse = useCallback(async () => {
    if (!agent) return;
    try {
      const res = await fetch('/api/browse-directory', { method: 'POST' });
      const data = await res.json();
      if (data.path) {
        onUpdateDirectory(agent.id, data.path);
      }
    } catch { /* dialog cancelled or server error */ }
  }, [agent, onUpdateDirectory]);

  const handleOpen = useCallback(async () => {
    if (!agent?.workDirectory) return;
    try {
      await fetch('/api/open-directory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: agent.workDirectory }),
      });
    } catch { /* ignore */ }
  }, [agent?.workDirectory]);

  const handleColorSelect = useCallback((color: string) => {
    if (!agent) return;
    onUpdateColor(agent.id, color);
    setColorPickerOpen(false);
  }, [agent, onUpdateColor]);

  const handleModeSelect = useCallback((mode: string) => {
    if (!agent) return;
    onUpdatePermissionMode(agent.id, mode);
    setModeSelectorOpen(false);
  }, [agent, onUpdatePermissionMode]);


  // Empty state when no agent selected
  if (!agent) {
    return (
      <div className="chat-panel">
        <div className="chat-panel__empty-state">
          Select an agent to view status and chat.
        </div>
      </div>
    );
  }

  // Get pending permission requests for this agent
  const agentPermissions = Array.from(permissionRequests.values()).filter(
    (r) => r.agentId === agent.id,
  );

  const agentColor = agent.color || '#5b6ee1';

  return (
    <div className="chat-panel">
      {/* Header: crab icon + name + status + WD + delete */}
      <div className="chat-panel__header">
        <div className="chat-panel__header-icon" onClick={() => setColorPickerOpen((v) => !v)}>
          <CrabIcon color={agentColor} size={32} />
          {colorPickerOpen && (
            <div className="chat-panel__color-picker">
              {AGENT_COLORS.map((c) => (
                <button
                  key={c}
                  className={`chat-panel__color-picker-swatch ${c === agentColor ? 'chat-panel__color-picker-swatch--active' : ''}`}
                  style={{ background: c }}
                  onClick={(e) => { e.stopPropagation(); handleColorSelect(c); }}
                />
              ))}
            </div>
          )}
        </div>
        <div className="chat-panel__header-info">
          <div className="chat-panel__header-row">
            <span className="chat-panel__header-label">name</span>
            <span className="chat-panel__header-name" onClick={startEditName}>
              {editingName ? (
                <input
                  ref={nameInputRef}
                  className="chat-panel__name-input chat-panel__name-input--header"
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  onBlur={commitName}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitName();
                    if (e.key === 'Escape') setEditingName(false);
                  }}
                />
              ) : (
                agent.name
              )}
            </span>
          </div>
          <div className="chat-panel__header-row">
            <span className="chat-panel__header-label">status</span>
            <span className="chat-panel__header-state">
              {agent.currentAction || STATE_LABELS[agent.state]}
            </span>
          </div>
          <div className="chat-panel__header-row">
            <span className="chat-panel__header-label">directory</span>
            <span className="chat-panel__header-wd">
              {agent.workDirectory ?? 'None'}
              {agent.workDirectory ? (
                <button className="chat-panel__dir-btn" onClick={handleOpen} title="Open in explorer">📂</button>
              ) : (
                <button className="chat-panel__dir-btn" onClick={handleBrowse} title="Set directory">📁</button>
              )}
            </span>
          </div>
          <div className="chat-panel__header-row">
            <span className="chat-panel__header-label">mode</span>
            <span
              className="chat-panel__header-mode"
              onClick={() => setModeSelectorOpen((v) => !v)}
            >
              {PERMISSION_MODES.find((m) => m.value === (agent.permissionMode ?? 'default'))?.label ?? agent.permissionMode}
              {modeSelectorOpen && (
                <div className="chat-panel__mode-selector">
                  {PERMISSION_MODES.map((m) => (
                    <button
                      key={m.value}
                      className={`chat-panel__mode-option ${m.value === (agent.permissionMode ?? 'default') ? 'chat-panel__mode-option--active' : ''}`}
                      onClick={(e) => { e.stopPropagation(); handleModeSelect(m.value); }}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              )}
            </span>
          </div>
        </div>
        <div className="chat-panel__header-actions">
          <button
            className="chat-panel__header-delete"
            onClick={() => onRemoveAgent(agent.id)}
            title="Remove agent"
          >
            🗑
          </button>
        </div>
      </div>

      {/* Chat */}
      <div className="chat-panel__log" ref={logRef} onScroll={handleScroll}>
            {agent.conversationLog
              .filter((entry) => entry.role !== 'tool' && entry.role !== 'system')
              .map((entry, i) => (
                <EntryItem key={i} entry={entry} agentName={agent.name} buddyName={buddyName} />
              ))}

            {/* Inline permission request cards */}
            {agentPermissions.map((req) =>
              req.type === 'ask_user_question' ? (
                <QuestionCard
                  key={req.requestId}
                  request={req}
                  onRespond={onRespondPermission}
                />
              ) : req.type === 'plan_confirm' ? (
                <div key={req.requestId} className="chat-panel__question-card">
                  <div className="chat-panel__question-card-header">
                    <span className="chat-panel__role" style={{ color: '#ff9933' }}>PLAN</span>
                  </div>
                  <div className="chat-panel__question-text">
                    Plan ready. Execute or revise?
                  </div>
                  <div className="chat-panel__tool-confirm-actions">
                    <button
                      className="chat-panel__question-submit"
                      onClick={() => {
                        onRespondPermission(req.requestId, req.agentId, req.type, { allowed: 'true' });
                        onUpdatePermissionMode(agent.id, 'default');
                        onSendPrompt(agent.id, 'Approve the plan. Execute it now.');
                      }}
                    >
                      Execute
                    </button>
                    <button
                      className="chat-panel__tool-deny"
                      onClick={() => {
                        onRespondPermission(req.requestId, req.agentId, req.type, { allowed: 'false' });
                        onUpdatePermissionMode(agent.id, 'default');
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <ToolConfirmCard
                  key={req.requestId}
                  request={req}
                  onRespond={onRespondPermission}
                />
              )
            )}

            {agent.state !== 'idle' && agent.state !== 'error' && agentPermissions.length === 0 && (
              <div className="chat-panel__activity">
                <span className="chat-panel__activity-dot" />
                {agent.currentAction || STATE_LABELS[agent.state]}
              </div>
            )}

            {/* Queued prompts shown as pending */}
            {queuedPrompts.map((prompt, i) => (
              <div key={`queued-${i}`} className="chat-panel__entry chat-panel__entry--queued">
                <div className="chat-panel__entry-header">
                  <span className="chat-panel__role" style={{ color: '#3fb950' }}>YOU</span>
                  <span className="chat-panel__timestamp">queued</span>
                </div>
                <div className="chat-panel__content">{prompt}</div>
              </div>
            ))}

            {agent.conversationLog.filter((e) => e.role !== 'tool' && e.role !== 'system').length === 0
              && agent.state === 'idle' && agentPermissions.length === 0 && queuedPrompts.length === 0 && (
              <div className="chat-panel__empty">
                <div className="chat-panel__empty-icon">💬</div>
                No messages yet.<br />
                Send a prompt below to start a conversation.
              </div>
            )}
          </div>

      <PromptInput
        agentId={agent.id}
        onSubmit={(prompt) => {
          const isWorking = agent.state !== 'idle' && agent.state !== 'error';
          if (isWorking) {
            setQueuedPrompts((prev) => [...prev, prompt]);
          }
          onSendPrompt(agent.id, prompt);
        }}
        prefill={promptPrefill}
        onPrefillConsumed={() => setPromptPrefill('')}
        isWorking={agent.state !== 'idle' && agent.state !== 'error'}
        onAbort={() => onAbortAgent(agent.id)}
        onListSkills={onListSkills}
      />
    </div>
  );
}
