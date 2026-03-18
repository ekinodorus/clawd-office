import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { ChatPanel } from '../components/ChatPanel';
import type { AgentInfo, PermissionRequest, SkillInfo } from '../types';

const noop = () => {};
const noopAsync = () => Promise.resolve({ skills: [] as SkillInfo[] });
const noopConfigAsync = () => Promise.resolve({ content: null });

function makeAgent(overrides?: Partial<AgentInfo>): AgentInfo {
  return {
    id: 'a-1',
    name: 'TestAgent',
    state: 'idle',
    currentAction: '',
    deskIndex: 0,
    color: '#5b6ee1',
    conversationLog: [],
    ...overrides,
  };
}

function renderPanel(
  agent: AgentInfo | null = makeAgent(),
  permissionRequests = new Map<string, PermissionRequest>(),
  overrides?: {
    onUpdateColor?: (agentId: string, color: string) => void;
  },
) {
  return render(
    <ChatPanel
      agent={agent}
      onSendPrompt={noop}
      onRemoveAgent={noop}
      onRenameAgent={noop}
      onUpdateDirectory={noop}
      onUpdateColor={overrides?.onUpdateColor ?? noop}
      onUpdatePermissionMode={noop}
      onAbortAgent={noop}
      permissionRequests={permissionRequests}
      onRespondPermission={noop}
      onListSkills={noopAsync}
      onGetClaudeConfig={noopConfigAsync}
    />
  );
}

describe('ChatPanel header', () => {
  it('displays agent name in header', async () => {
    await act(async () => { renderPanel(makeAgent({ name: 'MyCrab' })); });
    expect(screen.getByText('MyCrab')).toBeTruthy();
  });

  it('displays "name" label in header', async () => {
    await act(async () => { renderPanel(); });
    expect(screen.getByText('name')).toBeTruthy();
  });

  it('displays "status" label in header', async () => {
    await act(async () => { renderPanel(); });
    expect(screen.getByText('status')).toBeTruthy();
  });

  it('displays "directory" label in header', async () => {
    await act(async () => { renderPanel(); });
    expect(screen.getByText('directory')).toBeTruthy();
  });

  it('displays state label in header', async () => {
    let container: HTMLElement;
    await act(async () => { ({ container } = renderPanel(makeAgent({ state: 'coding' }))); });
    const headerState = container!.querySelector('.chat-panel__header-state');
    expect(headerState?.textContent).toContain('Coding');
  });

  it('renders crab icon canvas in header', async () => {
    let container: HTMLElement;
    await act(async () => { ({ container } = renderPanel()); });
    const canvas = container!.querySelector('.chat-panel__header canvas');
    expect(canvas).toBeTruthy();
  });

  it('renders delete button in header', async () => {
    let container: HTMLElement;
    await act(async () => { ({ container } = renderPanel()); });
    const deleteBtn = container!.querySelector('.chat-panel__header-delete');
    expect(deleteBtn).toBeTruthy();
  });

  it('shows working directory path in header', async () => {
    let container: HTMLElement;
    await act(async () => { ({ container } = renderPanel(makeAgent({ workDirectory: 'C:\\project' }))); });
    const wd = container!.querySelector('.chat-panel__header-wd');
    expect(wd?.textContent).toContain('C:\\project');
  });
});

describe('ChatPanel color picker', () => {
  it('shows color picker popup when crab icon is clicked', async () => {
    let container: HTMLElement;
    await act(async () => { ({ container } = renderPanel()); });
    const iconWrapper = container!.querySelector('.chat-panel__header-icon');
    expect(iconWrapper).toBeTruthy();
    await act(async () => { iconWrapper!.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    const picker = container!.querySelector('.chat-panel__color-picker');
    expect(picker).toBeTruthy();
  });

  it('renders color swatches in the picker', async () => {
    let container: HTMLElement;
    await act(async () => { ({ container } = renderPanel()); });
    const iconWrapper = container!.querySelector('.chat-panel__header-icon');
    await act(async () => { iconWrapper!.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    const swatches = container!.querySelectorAll('.chat-panel__color-picker-swatch');
    expect(swatches.length).toBeGreaterThanOrEqual(5);
  });

  it('calls onUpdateColor when a swatch is clicked', async () => {
    const onUpdateColor = vi.fn();
    let container: HTMLElement;
    await act(async () => { ({ container } = renderPanel(makeAgent(), new Map(), { onUpdateColor })); });
    const iconWrapper = container!.querySelector('.chat-panel__header-icon');
    await act(async () => { iconWrapper!.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    const swatches = container!.querySelectorAll('.chat-panel__color-picker-swatch');
    await act(async () => { (swatches[1] as HTMLElement).click(); });
    expect(onUpdateColor).toHaveBeenCalledWith('a-1', expect.any(String));
  });

  it('closes picker after selecting a color', async () => {
    let container: HTMLElement;
    await act(async () => { ({ container } = renderPanel()); });
    const iconWrapper = container!.querySelector('.chat-panel__header-icon');
    await act(async () => { iconWrapper!.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    const swatches = container!.querySelectorAll('.chat-panel__color-picker-swatch');
    await act(async () => { (swatches[0] as HTMLElement).click(); });
    const picker = container!.querySelector('.chat-panel__color-picker');
    expect(picker).toBeNull();
  });

  it('marks current color swatch as active', async () => {
    let container: HTMLElement;
    await act(async () => { ({ container } = renderPanel(makeAgent({ color: '#d95763' }))); });
    const iconWrapper = container!.querySelector('.chat-panel__header-icon');
    await act(async () => { iconWrapper!.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    const active = container!.querySelector('.chat-panel__color-picker-swatch--active');
    expect(active).toBeTruthy();
    expect((active as HTMLElement).style.background).toBe('rgb(217, 87, 99)');
  });
});


describe('ChatPanel empty state', () => {
  it('shows message when no agent selected', async () => {
    await act(async () => { renderPanel(null); });
    expect(screen.getByText(/Select an agent/)).toBeTruthy();
  });
});
