import { useState, useCallback } from 'react';
import { useSocket } from './hooks/useSocket';
import { useNotifications } from './hooks/useNotifications';
import { OfficeCanvas } from './pixi/OfficeCanvas';
import { AgentStatusBar } from './components/AgentStatusBar';
import { ChatPanel } from './components/ChatPanel';
import { AddAgentDialog } from './components/AddAgentDialog';
import { ConfirmDialog } from './components/ConfirmDialog';
import { BuddyPicker } from './components/BuddyPicker';
import { loadBuddySpecies, saveBuddySpecies, loadBuddyRarity, saveBuddyRarity, type BuddySpecies, type BuddyRarity } from './pixi/buddySprites';

export function App() {
  const { connected, agents, permissionRequests, addAgent, removeAgent, renameAgent, sendPrompt, updateDirectory, updateColor, updatePermissionMode, updateAllowedTools, abortAgent, respondPermission, listSkills, getClaudeConfig } = useSocket();
  const [panelAgentId, setPanelAgentId] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

  const { notificationsEnabled, toggleNotifications } = useNotifications(agents, permissionRequests);
  const [buddySpecies, setBuddySpecies] = useState<BuddySpecies>(loadBuddySpecies);
  const [buddyRarity, setBuddyRarity] = useState<BuddyRarity>(loadBuddyRarity);
  const [showBuddyPicker, setShowBuddyPicker] = useState(false);

  const handleBuddyChange = useCallback((species: BuddySpecies) => {
    setBuddySpecies(species);
    saveBuddySpecies(species);
    setShowBuddyPicker(false);
  }, []);

  const handleRarityChange = useCallback((rarity: BuddyRarity) => {
    setBuddyRarity(rarity);
    saveBuddyRarity(rarity);
  }, []);
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
          buddySpecies={buddySpecies}
          buddyRarity={buddyRarity}
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

      {/* Buddy picker dialog */}
      <BuddyPicker
        open={showBuddyPicker}
        current={buddySpecies}
        currentRarity={buddyRarity}
        onSelect={handleBuddyChange}
        onRaritySelect={handleRarityChange}
        onClose={() => setShowBuddyPicker(false)}
      />

      {/* Bottom status bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, position: 'fixed', bottom: 8, right: 12, zIndex: 100 }}>
        <button
          onClick={() => setShowBuddyPicker(true)}
          className="notification-toggle"
          title={`Buddy: ${buddySpecies} — click to change`}
        >
          /buddy
        </button>
        <button
          onClick={toggleNotifications}
          className="notification-toggle"
          title={notificationsEnabled ? 'Notifications ON — click to mute' : 'Notifications OFF — click to unmute'}
        >
          {notificationsEnabled ? '\u{1F514}' : '\u{1F515}'}
        </button>
        <div className={`connection-status ${connected ? 'connection-status--connected' : 'connection-status--disconnected'}`}>
          <span className="connection-status__dot" />
          {connected ? 'Connected' : 'Disconnected'}
        </div>
      </div>
    </div>
  );
}
