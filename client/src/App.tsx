import { useState, useCallback } from 'react';
import { useSocket } from './hooks/useSocket';
import { OfficeCanvas } from './pixi/OfficeCanvas';
import { AgentStatusBar } from './components/AgentStatusBar';
import { ChatPanel } from './components/ChatPanel';
import { AddAgentDialog } from './components/AddAgentDialog';
import { ConfirmDialog } from './components/ConfirmDialog';

export function App() {
  const { connected, agents, permissionRequests, addAgent, removeAgent, renameAgent, sendPrompt, updateDirectory, updateColor, updatePermissionMode, updateAllowedTools, abortAgent, respondPermission, listSkills, getClaudeConfig } = useSocket();
  const [panelAgentId, setPanelAgentId] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

  const panelAgent = panelAgentId ? agents.get(panelAgentId) ?? null : null;
  const confirmAgent = confirmRemoveId ? agents.get(confirmRemoveId) ?? null : null;

  const handleAgentClick = useCallback((agentId: string) => {
    setPanelAgentId(agentId);
  }, []);

  const handleAddAgent = useCallback(() => {
    setShowAddDialog(true);
  }, []);

  const handleAddSubmit = useCallback(
    (config: { name: string; workDirectory?: string; color?: string }) => {
      addAgent({ name: config.name, workDirectory: config.workDirectory, color: config.color });
      setShowAddDialog(false);
    },
    [addAgent],
  );

  const handleRemoveFromPanel = useCallback((agentId: string) => {
    setConfirmRemoveId(agentId);
  }, []);

  const handleConfirmRemove = useCallback(() => {
    if (confirmRemoveId) {
      removeAgent(confirmRemoveId);
      if (panelAgentId === confirmRemoveId) setPanelAgentId(null);
      setConfirmRemoveId(null);
    }
  }, [confirmRemoveId, panelAgentId, removeAgent]);

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AgentStatusBar
        agents={agents}
        selectedAgentId={panelAgentId}
        onAgentClick={handleAgentClick}
        onAddAgent={handleAddAgent}
      />

      {/* Stage + Panel row */}
      <div className="main-row">
        <OfficeCanvas
          agents={agents}
          selectedAgentId={panelAgentId}
          onAgentClick={handleAgentClick}
          onEmptyClick={() => setPanelAgentId(null)}
        />

        <ChatPanel
          agent={panelAgent}
          onSendPrompt={sendPrompt}
          onRemoveAgent={handleRemoveFromPanel}
          onRenameAgent={renameAgent}
          onUpdateDirectory={updateDirectory}
          onUpdateColor={updateColor}
          onUpdatePermissionMode={updatePermissionMode}
          onAbortAgent={abortAgent}
          permissionRequests={permissionRequests}
          onRespondPermission={respondPermission}
          onListSkills={listSkills}
          onGetClaudeConfig={getClaudeConfig}
        />
      </div>

      {/* Add agent dialog */}
      <AddAgentDialog
        open={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        onSubmit={handleAddSubmit}
      />

      {/* Confirm remove dialog */}
      <ConfirmDialog
        open={!!confirmRemoveId}
        onClose={() => setConfirmRemoveId(null)}
        onConfirm={handleConfirmRemove}
        title="Remove Agent"
        message={`Remove ${confirmAgent?.name ?? 'this agent'}?`}
        danger
      />

      {/* Connection status */}
      <div className={`connection-status ${connected ? 'connection-status--connected' : 'connection-status--disconnected'}`}>
        <span className="connection-status__dot" />
        {connected ? 'Connected' : 'Disconnected'}
      </div>
    </div>
  );
}
