import { useEffect, useRef, useCallback, useState } from 'react';
import type { AgentInfo, AgentState, PermissionRequest } from '../types';

// --- Web Audio synthesized sounds ---

let audioCtx: AudioContext | null = null;

function getAudioCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  return audioCtx;
}

/** Short rising chime — task complete */
function playComplete() {
  const ctx = getAudioCtx();
  const now = ctx.currentTime;
  const gain = ctx.createGain();
  gain.connect(ctx.destination);
  gain.gain.setValueAtTime(0.15, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

  // Two‑note arpeggio (C5 → E5)
  for (const [freq, offset] of [[523, 0], [659, 0.12]] as const) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    osc.connect(gain);
    osc.start(now + offset);
    osc.stop(now + 0.5);
  }
}

/** Attention ping — permission / waiting */
function playAttention() {
  const ctx = getAudioCtx();
  const now = ctx.currentTime;
  const gain = ctx.createGain();
  gain.connect(ctx.destination);
  gain.gain.setValueAtTime(0.18, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

  // Three quick pings descending (A5 → F#5 → D5)
  for (const [freq, offset] of [[880, 0], [740, 0.1], [587, 0.2]] as const) {
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    osc.connect(gain);
    osc.start(now + offset);
    osc.stop(now + offset + 0.15);
  }
}

/** Low buzz — error */
function playError() {
  const ctx = getAudioCtx();
  const now = ctx.currentTime;
  const gain = ctx.createGain();
  gain.connect(ctx.destination);
  gain.gain.setValueAtTime(0.12, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.value = 180;
  osc.connect(gain);
  osc.start(now);
  osc.stop(now + 0.4);
}

// --- Desktop notification helper ---

function desktopNotify(title: string, body: string) {
  if (Notification.permission !== 'granted') return;
  // Only notify when tab is not focused
  if (document.hasFocus()) return;
  new Notification(title, { body, icon: '/favicon.ico' });
}

// --- Working states (will trigger "complete" when transitioning to idle) ---

const WORKING_STATES = new Set<AgentState>([
  'coding',
  'running_command',
  'searching',
  'thinking',
  'planning',
]);

// --- Hook ---

export function useNotifications(
  agents: Map<string, AgentInfo>,
  permissionRequests: Map<string, PermissionRequest>,
) {
  const [enabled, setEnabled] = useState(() => {
    try {
      return localStorage.getItem('clawd-notifications') !== 'off';
    } catch {
      return true;
    }
  });

  const prevStates = useRef<Map<string, AgentState>>(new Map());
  const seenPermissions = useRef<Set<string>>(new Set());

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      try { localStorage.setItem('clawd-notifications', next ? 'on' : 'off'); } catch { /* */ }
      // Request permission on first enable
      if (next && Notification.permission === 'default') {
        Notification.requestPermission();
      }
      return next;
    });
  }, []);

  // Request notification permission on mount if enabled
  useEffect(() => {
    if (enabled && typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, [enabled]);

  // Watch agent state transitions
  useEffect(() => {
    if (!enabled) return;
    const prev = prevStates.current;

    for (const [id, agent] of agents) {
      const prevState = prev.get(id);

      if (prevState && prevState !== agent.state) {
        // Working → idle = task complete
        if (agent.state === 'idle' && WORKING_STATES.has(prevState)) {
          playComplete();
          desktopNotify(`${agent.name} - Done`, agent.currentAction || 'Task completed');
        }

        // Any → waiting_for_user
        if (agent.state === 'waiting_for_user' && prevState !== 'waiting_for_user') {
          playAttention();
          desktopNotify(`${agent.name} - Waiting`, 'Needs your input');
        }

        // Any → error
        if (agent.state === 'error' && prevState !== 'error') {
          playError();
          desktopNotify(`${agent.name} - Error`, agent.error || 'An error occurred');
        }
      }

      prev.set(id, agent.state);
    }

    // Clean up removed agents
    for (const id of prev.keys()) {
      if (!agents.has(id)) prev.delete(id);
    }
  }, [agents, enabled]);

  // Watch new permission requests
  useEffect(() => {
    if (!enabled) return;
    const seen = seenPermissions.current;

    for (const [reqId, req] of permissionRequests) {
      if (!seen.has(reqId)) {
        seen.add(reqId);
        const agent = agents.get(req.agentId);
        const name = agent?.name ?? 'Agent';
        playAttention();
        desktopNotify(`${name} - Permission`, `Requesting: ${req.toolName}`);
      }
    }

    // Clean up old
    for (const id of seen) {
      if (!permissionRequests.has(id)) seen.delete(id);
    }
  }, [permissionRequests, agents, enabled]);

  return { notificationsEnabled: enabled, toggleNotifications: toggle };
}
