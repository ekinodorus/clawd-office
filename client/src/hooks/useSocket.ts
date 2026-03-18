import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import type { AgentInfo, AgentState, ConversationEntry, AddAgentConfig, PermissionRequest, SubAgentInfo, SkillInfo } from '../types';

export interface UseSocketReturn {
  connected: boolean;
  agents: Map<string, AgentInfo>;
  permissionRequests: Map<string, PermissionRequest>;
  addAgent: (config: AddAgentConfig) => void;
  removeAgent: (agentId: string) => void;
  renameAgent: (agentId: string, name: string) => void;
  sendPrompt: (agentId: string, prompt: string) => void;
  updateDirectory: (agentId: string, workDirectory: string | null) => void;
  updateColor: (agentId: string, color: string) => void;
  updatePermissionMode: (agentId: string, permissionMode: string) => void;
  updateAllowedTools: (agentId: string, allowedTools: string[]) => void;
  abortAgent: (agentId: string) => void;
  respondPermission: (requestId: string, agentId: string, type: string, answers: Record<string, string>) => void;
  listSkills: (agentId: string) => Promise<{ skills: SkillInfo[] }>;
  getClaudeConfig: (agentId: string) => Promise<{ content: string | null }>;
}

export function useSocket(): UseSocketReturn {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [agents, setAgents] = useState<Map<string, AgentInfo>>(new Map());
  const [permissionRequests, setPermissionRequests] = useState<Map<string, PermissionRequest>>(new Map());

  useEffect(() => {
    const socket = io({ transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[Socket] Connected:', socket.id);
      setConnected(true);
      socket.emit('request_snapshot');
    });

    socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
      setConnected(false);
    });

    socket.on('agents_snapshot', (snapshot: AgentInfo[]) => {
      const map = new Map<string, AgentInfo>();
      for (const agent of snapshot) {
        map.set(agent.id, agent);
      }
      setAgents(map);
    });

    socket.on('agent_added', (agent: AgentInfo) => {
      setAgents((prev) => {
        const next = new Map(prev);
        next.set(agent.id, agent);
        return next;
      });
    });

    socket.on('agent_removed', (data: { agentId: string }) => {
      setAgents((prev) => {
        const next = new Map(prev);
        next.delete(data.agentId);
        return next;
      });
    });

    socket.on('agent_state_changed', (data: { agentId: string; state: AgentState; currentAction: string }) => {
      setAgents((prev) => {
        const agent = prev.get(data.agentId);
        if (!agent) return prev;
        const next = new Map(prev);
        next.set(data.agentId, {
          ...agent,
          state: data.state,
          currentAction: data.currentAction,
        });
        return next;
      });
    });

    socket.on('agent_conversation', (data: { agentId: string; entry: ConversationEntry }) => {
      setAgents((prev) => {
        const agent = prev.get(data.agentId);
        if (!agent) return prev;
        const next = new Map(prev);
        const updates: Partial<AgentInfo> = {
          conversationLog: [...agent.conversationLog, data.entry],
        };
        // Reset queue size when a queued user message starts processing
        if (data.entry.role === 'user' && (agent.queueSize ?? 0) > 0) {
          updates.queueSize = Math.max(0, (agent.queueSize ?? 0) - 1);
        }
        next.set(data.agentId, { ...agent, ...updates });
        return next;
      });
    });

    socket.on('agent_error', (data: { agentId: string; error: string }) => {
      setAgents((prev) => {
        const agent = prev.get(data.agentId);
        if (!agent) return prev;
        const next = new Map(prev);
        next.set(data.agentId, { ...agent, error: data.error });
        return next;
      });
    });

    socket.on('agent_renamed', (data: { agentId: string; name: string }) => {
      setAgents((prev) => {
        const agent = prev.get(data.agentId);
        if (!agent) return prev;
        const next = new Map(prev);
        next.set(data.agentId, { ...agent, name: data.name });
        return next;
      });
    });

    socket.on('agent_directory_changed', (data: { agentId: string; workDirectory: string | null; gitBranch: string | null }) => {
      setAgents((prev) => {
        const agent = prev.get(data.agentId);
        if (!agent) return prev;
        const next = new Map(prev);
        next.set(data.agentId, {
          ...agent,
          workDirectory: data.workDirectory ?? undefined,
          gitBranch: data.gitBranch ?? undefined,
        });
        return next;
      });
    });

    socket.on('agent_color_changed', (data: { agentId: string; color: string }) => {
      setAgents((prev) => {
        const agent = prev.get(data.agentId);
        if (!agent) return prev;
        const next = new Map(prev);
        next.set(data.agentId, { ...agent, color: data.color });
        return next;
      });
    });

    socket.on('agent_aborted', (data: { agentId: string }) => {
      // Clear permission requests for this agent
      setPermissionRequests((prev) => {
        const next = new Map(prev);
        for (const [key, req] of prev) {
          if (req.agentId === data.agentId) next.delete(key);
        }
        return next.size !== prev.size ? next : prev;
      });
    });

    socket.on('agent_allowed_tools_changed', (data: { agentId: string; allowedTools: string[] }) => {
      setAgents((prev) => {
        const agent = prev.get(data.agentId);
        if (!agent) return prev;
        const next = new Map(prev);
        next.set(data.agentId, { ...agent, allowedTools: data.allowedTools });
        return next;
      });
    });

    socket.on('agent_permission_mode_changed', (data: { agentId: string; permissionMode: string }) => {
      setAgents((prev) => {
        const agent = prev.get(data.agentId);
        if (!agent) return prev;
        const next = new Map(prev);
        next.set(data.agentId, { ...agent, permissionMode: data.permissionMode });
        return next;
      });
    });

    socket.on('permission_request', (data: PermissionRequest) => {
      setPermissionRequests((prev) => {
        const next = new Map(prev);
        next.set(data.requestId, data);
        return next;
      });
    });

    socket.on('agent_queue_update', (data: { agentId: string; queueSize: number }) => {
      setAgents((prev) => {
        const agent = prev.get(data.agentId);
        if (!agent) return prev;
        const next = new Map(prev);
        next.set(data.agentId, { ...agent, queueSize: data.queueSize });
        return next;
      });
    });

    socket.on('agent_sub_spawned', (data: { agentId: string; subAgent: SubAgentInfo }) => {
      setAgents((prev) => {
        const agent = prev.get(data.agentId);
        if (!agent) return prev;
        const next = new Map(prev);
        next.set(data.agentId, {
          ...agent,
          subAgents: [...(agent.subAgents ?? []), data.subAgent],
        });
        return next;
      });
    });

    socket.on('agent_sub_removed', (data: { agentId: string; subAgentId: string }) => {
      setAgents((prev) => {
        const agent = prev.get(data.agentId);
        if (!agent) return prev;
        const next = new Map(prev);
        next.set(data.agentId, {
          ...agent,
          subAgents: (agent.subAgents ?? []).filter((s) => s.id !== data.subAgentId),
        });
        return next;
      });
    });

    return () => {
      socket.off('agents_snapshot');
      socket.off('agent_added');
      socket.off('agent_removed');
      socket.off('agent_renamed');
      socket.off('agent_state_changed');
      socket.off('agent_conversation');
      socket.off('agent_error');
      socket.off('agent_directory_changed');
      socket.off('agent_color_changed');
      socket.off('agent_permission_mode_changed');
      socket.off('agent_allowed_tools_changed');
      socket.off('agent_aborted');
      socket.off('permission_request');
      socket.off('agent_sub_spawned');
      socket.off('agent_sub_removed');
      socket.off('agent_queue_update');
      socket.disconnect();
    };
  }, []);

  const addAgent = useCallback((config: AddAgentConfig) => {
    socketRef.current?.emit('add_agent', config);
  }, []);

  const removeAgent = useCallback((agentId: string) => {
    socketRef.current?.emit('remove_agent', { agentId });
  }, []);

  const renameAgent = useCallback((agentId: string, name: string) => {
    socketRef.current?.emit('rename_agent', { agentId, name });
  }, []);

  const sendPrompt = useCallback((agentId: string, prompt: string) => {
    const socket = socketRef.current;
    if (!socket?.connected) {
      console.warn('[Socket] sendPrompt failed: not connected');
      return;
    }
    console.log('[Socket] sendPrompt:', agentId, prompt.slice(0, 40));
    socket.emit('send_prompt', { agentId, prompt });
  }, []);

  const updateDirectory = useCallback((agentId: string, workDirectory: string | null) => {
    socketRef.current?.emit('update_directory', { agentId, workDirectory });
  }, []);

  const updateColor = useCallback((agentId: string, color: string) => {
    socketRef.current?.emit('update_color', { agentId, color });
  }, []);

  const updatePermissionMode = useCallback((agentId: string, permissionMode: string) => {
    socketRef.current?.emit('update_permission_mode', { agentId, permissionMode });
  }, []);

  const updateAllowedTools = useCallback((agentId: string, allowedTools: string[]) => {
    socketRef.current?.emit('update_allowed_tools', { agentId, allowedTools });
  }, []);

  const abortAgent = useCallback((agentId: string) => {
    socketRef.current?.emit('abort_agent', { agentId });
  }, []);

  const respondPermission = useCallback((requestId: string, agentId: string, type: string, answers: Record<string, string>) => {
    socketRef.current?.emit('permission_response', { requestId, agentId, type, answers });
    setPermissionRequests((prev) => {
      const next = new Map(prev);
      next.delete(requestId);
      return next;
    });
  }, []);

  const listSkills = useCallback((agentId: string): Promise<{ skills: SkillInfo[] }> => {
    return new Promise((resolve) => {
      socketRef.current?.emit('list_skills', { agentId }, (result: { skills: SkillInfo[] }) => {
        resolve(result);
      });
    });
  }, []);

  const getClaudeConfig = useCallback((agentId: string): Promise<{ content: string | null }> => {
    return new Promise((resolve) => {
      socketRef.current?.emit('get_claude_config', { agentId }, (result: { content: string | null }) => {
        resolve(result);
      });
    });
  }, []);

  return { connected, agents, permissionRequests, addAgent, removeAgent, renameAgent, sendPrompt, updateDirectory, updateColor, updatePermissionMode, updateAllowedTools, abortAgent, respondPermission, listSkills, getClaudeConfig };
}
