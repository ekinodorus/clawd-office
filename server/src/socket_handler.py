"""Socket.IO event handlers."""

from __future__ import annotations

import socketio

from src.agent_manager import AgentManager


def setup_socket_handler(sio: socketio.AsyncServer, manager: AgentManager) -> None:
    """Wire up Socket.IO events to the AgentManager."""

    @sio.on("connect")
    async def on_connect(sid: str, environ: dict) -> None:
        print(f"[Socket] Client connected: {sid}")
        await sio.emit("agents_snapshot", manager.get_agents(), to=sid)

    @sio.on("disconnect")
    async def on_disconnect(sid: str) -> None:
        print(f"[Socket] Client disconnected: {sid}")

    @sio.on("add_agent")
    async def on_add_agent(sid: str, data: dict) -> None:
        name = data.get("name", "Agent")
        prompt = data.get("prompt")
        work_dir = data.get("workDirectory")
        color = data.get("color")
        print(f"[Socket] add_agent: {name}")
        await manager.add_agent(name, prompt=prompt, work_directory=work_dir, color=color)

    @sio.on("remove_agent")
    async def on_remove_agent(sid: str, data: dict) -> None:
        agent_id = data.get("agentId", "")
        print(f"[Socket] remove_agent: {agent_id}")
        await manager.remove_agent(agent_id)

    @sio.on("abort_agent")
    async def on_abort_agent(sid: str, data: dict) -> None:
        agent_id = data.get("agentId", "")
        print(f"[Socket] abort_agent: {agent_id}")
        await manager.abort_agent(agent_id)

    @sio.on("rename_agent")
    async def on_rename_agent(sid: str, data: dict) -> None:
        agent_id = data.get("agentId", "")
        name = data.get("name", "")
        print(f"[Socket] rename_agent: {agent_id} -> {name}")
        await manager.rename_agent(agent_id, name)

    @sio.on("update_directory")
    async def on_update_directory(sid: str, data: dict) -> None:
        agent_id = data.get("agentId", "")
        work_dir = data.get("workDirectory")
        print(f"[Socket] update_directory: {agent_id} -> {work_dir}")
        await manager.update_directory(agent_id, work_dir)

    @sio.on("update_color")
    async def on_update_color(sid: str, data: dict) -> None:
        agent_id = data.get("agentId", "")
        color = data.get("color", "")
        print(f"[Socket] update_color: {agent_id} -> {color}")
        await manager.update_color(agent_id, color)

    @sio.on("update_permission_mode")
    async def on_update_permission_mode(sid: str, data: dict) -> None:
        agent_id = data.get("agentId", "")
        permission_mode = data.get("permissionMode", "default")
        print(f"[Socket] update_permission_mode: {agent_id} -> {permission_mode}")
        await manager.update_permission_mode(agent_id, permission_mode)

    @sio.on("update_allowed_tools")
    async def on_update_allowed_tools(sid: str, data: dict) -> None:
        agent_id = data.get("agentId", "")
        allowed_tools = set(data.get("allowedTools", []))
        print(f"[Socket] update_allowed_tools: {agent_id} -> {allowed_tools}")
        await manager.update_allowed_tools(agent_id, allowed_tools)

    @sio.on("send_prompt")
    async def on_send_prompt(sid: str, data: dict) -> None:
        agent_id = data.get("agentId", "")
        prompt = data.get("prompt", "")
        print(f"[Socket] send_prompt to {agent_id}: {prompt[:80]}...")
        await manager.send_prompt(agent_id, prompt)

    @sio.on("request_snapshot")
    async def on_request_snapshot(sid: str) -> None:
        await sio.emit("agents_snapshot", manager.get_agents(), to=sid)

    @sio.on("permission_response")
    async def on_permission_response(sid: str, data: dict) -> None:
        request_id = data.get("requestId", "")
        answers = data.get("answers", {})
        print(f"[Socket] permission_response: {request_id}")
        manager.resolve_permission(request_id, answers)

    @sio.on("list_skills")
    async def on_list_skills(sid: str, data: dict, callback=None) -> None:
        agent_id = data.get("agentId", "")
        result = await manager.list_skills(agent_id)
        if callback:
            callback(result)

    @sio.on("get_claude_config")
    async def on_get_claude_config(sid: str, data: dict, callback=None) -> None:
        agent_id = data.get("agentId", "")
        result = await manager.get_claude_config(agent_id)
        if callback:
            callback(result)
