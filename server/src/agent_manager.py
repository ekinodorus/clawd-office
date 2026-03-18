"""Agent lifecycle management."""

from __future__ import annotations

import asyncio
import os
import queue
import re
import sys
import threading
import time
import uuid
from pathlib import Path
from typing import Any

import socketio

from src.models import AgentInfo, ConversationEntry, SubAgentInfo, MAX_DESKS
from src.agent_state import AgentStateTracker


# Monkey-patch SDK to skip unknown message types instead of crashing
def _patch_sdk_parser() -> None:
    try:
        import claude_code_sdk._internal.client as _client_mod
        _orig = _client_mod.parse_message

        def _safe_parse(data: dict) -> object | None:
            try:
                return _orig(data)
            except Exception as e:
                if "Unknown message type" in str(e):
                    print(f"[SDK Patch] Skipping unknown message type: {data.get('type', '?')}")
                    return None
                raise

        _client_mod.parse_message = _safe_parse
        print("[SDK Patch] parse_message patched for resilience")
    except Exception as e:
        print(f"[SDK Patch] Could not patch: {e}")


_patch_sdk_parser()

_next_id = 0


def _gen_id() -> str:
    global _next_id
    _next_id += 1
    return f"agent-{_next_id}"


_SENTINEL = object()  # marks end of stream


def _run_sdk_in_thread(sdk: Any, prompt: str, cwd: str | None, queue: Any, permission_mode: str = "default", continue_conversation: bool = False, pre_tool_hook: Any = None) -> None:
    """Run sdk.query() in a separate thread with its own ProactorEventLoop.

    Puts each message into the queue as it arrives for real-time streaming.
    """
    # Prevent "nested session" error when server is launched from within Claude Code
    os.environ.pop("CLAUDECODE", None)

    async def _inner():
        try:
            from claude_code_sdk.types import HookMatcher

            # bypassPermissions so CLI doesn't block tools (no terminal for prompts).
            # PreToolUse hooks handle permission confirmation via UI.
            if permission_mode == "plan":
                sdk_mode = "plan"
            else:
                sdk_mode = "bypassPermissions"

            options = sdk.ClaudeCodeOptions(
                max_turns=10,
                cwd=cwd,
                permission_mode=sdk_mode,
                continue_conversation=continue_conversation,
            )

            _deferred_stdin = {}

            if pre_tool_hook is not None:
                options.hooks = {
                    "PreToolUse": [HookMatcher(matcher=None, hooks=[pre_tool_hook])],
                }

            if pre_tool_hook is not None:
                # Hooks require streaming mode (AsyncIterable prompt) because
                # initialize() only registers hooks when is_streaming_mode=True.
                #
                # Problem: After the AsyncIterable exhausts, stream_input() calls
                # end_input() which closes stdin. But hook callback responses need
                # stdin to be open. The CLI treats a closed stdin as "stream closed"
                # and refuses to send hook_callback requests.
                #
                # Solution: Monkey-patch end_input() to defer stdin closure.
                # Save the stdin stream reference, let end_input() be a no-op,
                # then close stdin manually after ResultMessage is received
                # (all hooks are done by then).
                try:
                    from claude_code_sdk._internal.transport import subprocess_cli as _cli_transport
                    _orig_end_input = _cli_transport.SubprocessCLITransport.end_input

                    async def _deferred_end_input(transport_self):
                        # Save reference instead of closing
                        _deferred_stdin["stream"] = transport_self._stdin_stream
                        _deferred_stdin["transport"] = transport_self

                    _cli_transport.SubprocessCLITransport.end_input = _deferred_end_input
                except Exception as patch_err:
                    print(f"[SDK Patch] Could not patch end_input: {patch_err}")

                async def _prompt_iter():
                    yield {
                        "type": "user",
                        "message": {"role": "user", "content": prompt},
                        "parent_tool_use_id": None,
                        "session_id": None,
                    }
                query_prompt = _prompt_iter()
            else:
                query_prompt = prompt

            print(f"[SDK Thread] Starting query (mode={sdk_mode}, hooks={pre_tool_hook is not None})...")
            async for message in sdk.query(prompt=query_prompt, options=options):
                if message is None:
                    continue
                print(f"[SDK Thread] Got: {type(message).__name__}")
                queue.put(message)
                # After ResultMessage, close stdin to let CLI terminate
                if isinstance(message, sdk.ResultMessage) and _deferred_stdin.get("stream"):
                    print("[SDK Thread] ResultMessage received, closing deferred stdin...")
                    try:
                        await _deferred_stdin["stream"].aclose()
                        transport_ref = _deferred_stdin.get("transport")
                        if transport_ref:
                            transport_ref._stdin_stream = None
                    except Exception:
                        pass
        except Exception as e:
            print(f"[SDK Thread] Error: {e}")
            queue.put(e)
        queue.put(_SENTINEL)

    if sys.platform == "win32":
        loop = asyncio.ProactorEventLoop()
    else:
        loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        loop.run_until_complete(_inner())
    finally:
        loop.close()


class AgentManager:
    """Manages agent lifecycle, state tracking, and SDK sessions."""

    def __init__(self, sio: socketio.AsyncServer) -> None:
        self.sio = sio
        self._agents: dict[str, AgentInfo] = {}
        self._trackers: dict[str, AgentStateTracker] = {}
        self._queue_locks: dict[str, asyncio.Lock] = {}
        self._next_desk = 0
        self._sdk: Any = None
        self._sdk_loaded = False
        self._main_loop: asyncio.AbstractEventLoop | None = None
        self._pending_permissions: dict[str, dict] = {}
        self._cancelled: set[str] = set()
        self._plan_confirm_pending: set[str] = set()
        try:
            self._main_loop = asyncio.get_event_loop()
        except RuntimeError:
            pass

    async def _load_sdk(self) -> Any:
        if not self._sdk_loaded:
            self._sdk_loaded = True
            try:
                import claude_code_sdk as sdk
                self._sdk = sdk
                print("[AgentManager] Claude Code SDK loaded successfully")
            except Exception as e:
                print(f"[AgentManager] Claude Code SDK not available: {e}")
        return self._sdk

    # -- Helpers ---------------------------------------------------------------

    @staticmethod
    async def _detect_git_branch(directory: str) -> str | None:
        try:
            proc = await asyncio.create_subprocess_exec(
                "git", "-C", directory, "rev-parse", "--abbrev-ref", "HEAD",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, _ = await proc.communicate()
            if proc.returncode == 0:
                branch = stdout.decode().strip()
                if not branch or branch == "HEAD":
                    return None
                return branch
        except Exception:
            pass
        return None

    # -- Public API ------------------------------------------------------------

    async def add_agent(self, name: str, prompt: str | None = None, work_directory: str | None = None, color: str | None = None) -> AgentInfo:
        agent_id = _gen_id()
        desk_index = self._next_desk % MAX_DESKS
        self._next_desk += 1

        git_branch = None
        if work_directory:
            git_branch = await self._detect_git_branch(work_directory)

        agent = AgentInfo(
            id=agent_id,
            name=name,
            desk_index=desk_index,
            color=color,
            work_directory=work_directory,
            git_branch=git_branch,
        )

        tracker = AgentStateTracker()

        def _on_change(state: str, action: str) -> None:
            agent.state = state
            agent.current_action = action
            asyncio.ensure_future(
                self.sio.emit("agent_state_changed", {
                    "agentId": agent_id,
                    "state": state,
                    "currentAction": action,
                })
            )

        tracker.on_change(_on_change)

        self._agents[agent_id] = agent
        self._trackers[agent_id] = tracker
        self._queue_locks[agent_id] = asyncio.Lock()

        await self.sio.emit("agent_added", agent.to_client_dict())
        asyncio.ensure_future(self._load_sdk())

        if prompt:
            await self.send_prompt(agent_id, prompt)

        return agent

    def _make_pre_tool_hook(self, agent_id: str):
        """Create a PreToolUse hook callback for permission confirmation."""
        manager = self
        agent = self._agents.get(agent_id)
        is_plan_mode = agent and agent.permission_mode == "plan"

        # Read-only tools that don't need confirmation
        SAFE_TOOLS = {"Read", "Glob", "Grep", "WebSearch", "WebFetch", "TodoRead", "TodoWrite",
                       "Agent", "EnterPlanMode", "ExitPlanMode",
                       "TaskCreate", "TaskGet", "TaskUpdate", "TaskList"}

        async def _pre_tool_use(hook_input: dict, tool_use_id: str | None, context: Any) -> dict:
            tool_name = hook_input.get("tool_name", "unknown")
            tool_input = hook_input.get("tool_input", {})
            print(f"[PreToolUse] Tool: {tool_name} (agent={agent_id})")

            # If already cancelled (e.g. user denied a previous tool), block immediately
            if agent_id in manager._cancelled:
                print(f"[PreToolUse] Already cancelled, blocking {tool_name}")
                return {"decision": "block"}

            # AskUserQuestion: relay to UI and return user's answer as systemMessage
            if tool_name == "AskUserQuestion":
                print(f"[PreToolUse] Relaying AskUserQuestion to UI")
                return await manager._handle_ask_user_question_hook(agent_id, tool_input)

            # Auto-approve safe tools or tools in agent's allowed_tools
            if tool_name in SAFE_TOOLS or (agent and tool_name in agent.allowed_tools):
                print(f"[PreToolUse] Auto-approved: {tool_name}")
                return {}

            # In plan mode, auto-approve all other tools (plan shouldn't execute them)
            if is_plan_mode:
                print(f"[PreToolUse] Auto-approved (plan mode): {tool_name}")
                return {}

            # For dangerous tools (Write, Edit, Bash, etc.), ask user
            print(f"[PreToolUse] Requesting permission for {tool_name}")
            return await manager._handle_tool_permission(agent_id, tool_name, tool_input)

        return _pre_tool_use

    def resolve_permission(self, request_id: str, answers: dict) -> None:
        """Resolve a pending permission request with user answers."""
        entry = self._pending_permissions.get(request_id)
        if not entry:
            print(f"[Permission] No pending request for {request_id}")
            return
        print(f"[Permission] Resolving {request_id} with {answers}")
        entry["result"] = answers
        # threading.Event.set() is thread-safe
        entry["event"].set()  # Unblocks _blocking_wait in _handle_tool_permission

    async def _emit_and_wait_permission(self, agent_id: str, req_type: str, tool_name: str, tool_input: dict) -> dict:
        """Emit a permission_request to the UI and block until the user responds.

        Uses threading.Event for cross-thread synchronization between the
        SDK thread (anyio) and the main event loop thread.
        Returns the user's answers dict.
        """
        import anyio

        request_id = str(uuid.uuid4())
        t_event = threading.Event()
        self._pending_permissions[request_id] = {
            "event": t_event,
            "agent_id": agent_id,
            "result": None,
        }

        print(f"[Permission] Emitting {req_type} request {request_id} for {tool_name}")
        if self._main_loop:
            asyncio.run_coroutine_threadsafe(
                self.sio.emit("permission_request", {
                    "requestId": request_id,
                    "agentId": agent_id,
                    "type": req_type,
                    "toolName": tool_name,
                    "toolInput": tool_input,
                }),
                self._main_loop,
            )
            # Show "waiting_for_user" state while waiting for permission
            if req_type == "tool_confirm":
                tracker = self._trackers.get(agent_id)
                if tracker:
                    asyncio.run_coroutine_threadsafe(
                        self._set_waiting_state(agent_id, tracker),
                        self._main_loop,
                    )

        def _blocking_wait():
            t_event.wait(timeout=120)

        await anyio.to_thread.run_sync(_blocking_wait)

        entry = self._pending_permissions.pop(request_id, {})
        answers = entry.get("result")
        if answers is None:
            print(f"[Permission] Timeout for {tool_name}, auto-denying")
            answers = {"allowed": "false"}
        print(f"[Permission] Got answer for {tool_name}: {answers}")
        return answers

    async def _set_waiting_state(self, agent_id: str, tracker: AgentStateTracker) -> None:
        """Set agent state to waiting_for_user (called from SDK thread via main loop)."""
        tracker.on_waiting_for_user()

    async def _restore_tool_state(self, agent_id: str, tracker: AgentStateTracker, tool_name: str, tool_input: dict) -> None:
        """Restore agent state from waiting_for_user to the tool-appropriate state."""
        tracker.on_tool_use(tool_name, tool_input)

    async def _handle_tool_permission(self, agent_id: str, tool_name: str, tool_input: dict) -> dict:
        """Relay a tool permission request to the UI and wait for allow/deny.

        Returns HookJSONOutput dict: {} to allow, {"decision": "block"} to deny.
        On deny, also aborts the turn so Claude doesn't respond about the block.
        """
        answers = await self._emit_and_wait_permission(agent_id, "tool_confirm", tool_name, tool_input)
        if answers.get("allowed") == "true":
            # Restore state from waiting_for_user to tool-appropriate state
            tracker = self._trackers.get(agent_id)
            if tracker and self._main_loop:
                asyncio.run_coroutine_threadsafe(
                    self._restore_tool_state(agent_id, tracker, tool_name, tool_input),
                    self._main_loop,
                )
            return {}
        # Abort the turn so the SDK stops — prevents "blocked by hook" response
        self._cancelled.add(agent_id)
        if self._main_loop:
            asyncio.run_coroutine_threadsafe(
                self.sio.emit("agent_aborted", {"agentId": agent_id}),
                self._main_loop,
            )
        return {"decision": "block"}

    async def _handle_ask_user_question_hook(self, agent_id: str, tool_input: dict) -> dict:
        """Relay AskUserQuestion to UI and return user's answer as systemMessage.

        PreToolUse hooks can only approve/block (not modify input), so we block
        the tool and include the user's answer in systemMessage for the agent.
        """
        answers = await self._emit_and_wait_permission(agent_id, "ask_user_question", "AskUserQuestion", tool_input)
        questions = tool_input.get("questions", [])
        answer_parts = []
        for k, v in answers.items():
            if not k or not v:
                continue
            idx = int(k.replace("q", "")) if k.startswith("q") and k[1:].isdigit() else -1
            if 0 <= idx < len(questions):
                q_text = questions[idx].get("question", k)
                answer_parts.append(f"{q_text} → {v}")
            else:
                answer_parts.append(f"{k}: {v}")
        answer_text = ", ".join(answer_parts) if answer_parts else "No answer provided"
        return {
            "decision": "block",
            "systemMessage": f"User answered the question: {answer_text}",
        }

    async def abort_agent(self, agent_id: str) -> bool:
        """Abort the current SDK session for the agent."""
        agent = self._agents.get(agent_id)
        if not agent:
            return False

        self._cancelled.add(agent_id)
        agent.prompt_queue.clear()

        # Cancel pending permissions by setting event with deny result
        to_remove = [rid for rid, entry in self._pending_permissions.items() if entry["agent_id"] == agent_id]
        for rid in to_remove:
            entry = self._pending_permissions.pop(rid)
            entry["result"] = {"allowed": "false"}
            entry["event"].set()

        await self.sio.emit("agent_aborted", {"agentId": agent_id})
        return True

    async def remove_agent(self, agent_id: str) -> bool:
        agent = self._agents.get(agent_id)
        if not agent:
            return False

        # Abort any running session
        self._cancelled.add(agent_id)

        # Cancel pending permissions by setting event with deny result
        to_remove = [rid for rid, entry in self._pending_permissions.items() if entry["agent_id"] == agent_id]
        for rid in to_remove:
            entry = self._pending_permissions.pop(rid)
            entry["result"] = {"allowed": "false"}
            entry["event"].set()

        tracker = self._trackers.pop(agent_id, None)
        if tracker:
            tracker.dispose()

        self._queue_locks.pop(agent_id, None)
        del self._agents[agent_id]
        await self.sio.emit("agent_removed", {"agentId": agent_id})
        return True

    async def rename_agent(self, agent_id: str, name: str) -> bool:
        agent = self._agents.get(agent_id)
        if not agent:
            return False

        agent.name = name
        await self.sio.emit("agent_renamed", {"agentId": agent_id, "name": name})
        return True

    async def update_color(self, agent_id: str, color: str) -> bool:
        agent = self._agents.get(agent_id)
        if not agent:
            return False

        agent.color = color
        await self.sio.emit("agent_color_changed", {
            "agentId": agent_id,
            "color": color,
        })
        return True

    async def update_permission_mode(self, agent_id: str, permission_mode: str) -> bool:
        agent = self._agents.get(agent_id)
        if not agent:
            return False

        agent.permission_mode = permission_mode
        await self.sio.emit("agent_permission_mode_changed", {
            "agentId": agent_id,
            "permissionMode": permission_mode,
        })
        return True

    async def update_allowed_tools(self, agent_id: str, allowed_tools: set[str]) -> bool:
        agent = self._agents.get(agent_id)
        if not agent:
            return False

        agent.allowed_tools = allowed_tools
        await self.sio.emit("agent_allowed_tools_changed", {
            "agentId": agent_id,
            "allowedTools": sorted(allowed_tools),
        })
        return True

    async def update_directory(self, agent_id: str, work_directory: str | None) -> bool:
        agent = self._agents.get(agent_id)
        if not agent:
            return False

        agent.work_directory = work_directory
        agent.git_branch = None
        if work_directory:
            agent.git_branch = await self._detect_git_branch(work_directory)

        await self.sio.emit("agent_directory_changed", {
            "agentId": agent_id,
            "workDirectory": work_directory,
            "gitBranch": agent.git_branch,
        })
        return True

    async def send_prompt(self, agent_id: str, prompt: str) -> None:
        agent = self._agents.get(agent_id)
        if not agent:
            print(f"[AgentManager] send_prompt: agent {agent_id} not found (known: {list(self._agents.keys())})")
            return

        agent.prompt_queue.append(prompt)
        if not agent.busy:
            asyncio.ensure_future(self._process_queue(agent_id))
        else:
            # Notify client about queue size so UI can show pending count
            await self.sio.emit("agent_queue_update", {
                "agentId": agent_id,
                "queueSize": len(agent.prompt_queue),
            })

    def get_agents(self) -> list[dict]:
        return [a.to_client_dict() for a in self._agents.values()]

    def get_agent(self, agent_id: str) -> dict | None:
        agent = self._agents.get(agent_id)
        return agent.to_client_dict() if agent else None

    async def list_skills(self, agent_id: str) -> dict:
        """List skills from the agent's workDirectory/.claude/skills/*/SKILL.md."""
        agent = self._agents.get(agent_id)
        if not agent or not agent.work_directory:
            return {"skills": []}

        skills_dir = Path(agent.work_directory) / ".claude" / "skills"
        if not skills_dir.is_dir():
            return {"skills": []}

        skills = []
        try:
            for skill_dir in sorted(skills_dir.iterdir()):
                skill_file = skill_dir / "SKILL.md"
                if not skill_file.is_file():
                    continue
                try:
                    content = skill_file.read_text(encoding="utf-8")
                    # Parse YAML frontmatter
                    name = skill_dir.name
                    description = ""
                    argument_hint = ""
                    fm_match = re.match(r"^---\s*\n(.*?)\n---", content, re.DOTALL)
                    if fm_match:
                        fm = fm_match.group(1)
                        for line in fm.split("\n"):
                            if line.startswith("name:"):
                                name = line.split(":", 1)[1].strip().strip('"\'')
                            elif line.startswith("description:"):
                                description = line.split(":", 1)[1].strip().strip('"\'')
                            elif line.startswith("argument-hint:"):
                                argument_hint = line.split(":", 1)[1].strip().strip('"\'')
                    skills.append({
                        "name": name,
                        "description": description,
                        "argumentHint": argument_hint,
                    })
                except Exception:
                    continue
        except (FileNotFoundError, PermissionError):
            return {"skills": []}
        return {"skills": skills}

    async def get_claude_config(self, agent_id: str) -> dict:
        """Read CLAUDE.md from the agent's workDirectory."""
        agent = self._agents.get(agent_id)
        if not agent or not agent.work_directory:
            return {"content": None}

        claude_md = Path(agent.work_directory) / "CLAUDE.md"
        if not claude_md.is_file():
            return {"content": None}

        try:
            content = claude_md.read_text(encoding="utf-8")
            return {"content": content}
        except Exception:
            return {"content": None}

    # -- Internal --------------------------------------------------------------

    async def _process_queue(self, agent_id: str) -> None:
        agent = self._agents.get(agent_id)
        tracker = self._trackers.get(agent_id)
        if not agent or not tracker:
            return

        async with self._queue_locks.get(agent_id, asyncio.Lock()):
            while agent.prompt_queue:
                # Clear cancelled flag at the start of each new prompt
                self._cancelled.discard(agent_id)
                prompt = agent.prompt_queue.pop(0)
                agent.busy = True

                user_entry = ConversationEntry(
                    timestamp=time.time() * 1000,
                    role="user",
                    content=prompt,
                )
                agent.conversation_log.append(user_entry)
                await self.sio.emit("agent_conversation", {
                    "agentId": agent_id,
                    "entry": user_entry.to_dict(),
                })

                tracker.on_user_message()

                sdk = await self._load_sdk()
                if not sdk:
                    stub = ConversationEntry(
                        timestamp=time.time() * 1000,
                        role="system",
                        content="Claude Code SDK not available.",
                    )
                    agent.conversation_log.append(stub)
                    await self.sio.emit("agent_conversation", {
                        "agentId": agent_id,
                        "entry": stub.to_dict(),
                    })
                    agent.busy = False
                    tracker.on_turn_complete()
                    continue

                try:
                    await self._run_sdk_turn(agent_id, sdk, prompt)
                except Exception as e:
                    error_msg = str(e)
                    agent.error = error_msg
                    tracker.on_error(error_msg)
                    await self.sio.emit("agent_error", {"agentId": agent_id, "error": error_msg})
                finally:
                    agent.busy = False
                    # Clear sub-agents on turn complete
                    if agent.sub_agents:
                        subs_to_remove = list(agent.sub_agents)
                        agent.sub_agents.clear()
                        for sub in subs_to_remove:
                            await self.sio.emit("agent_sub_removed", {
                                "agentId": agent_id,
                                "subAgentId": sub.id,
                            })
                    tracker.on_turn_complete()
                    # Emit deferred plan_confirm after all messages are processed
                    await self._emit_deferred_plan_confirm(agent_id)

    async def _emit_deferred_plan_confirm(self, agent_id: str) -> None:
        """Emit plan_confirm permission_request if ExitPlanMode was detected this turn."""
        if agent_id not in self._plan_confirm_pending:
            return
        self._plan_confirm_pending.discard(agent_id)
        request_id = str(uuid.uuid4())
        await self.sio.emit("permission_request", {
            "requestId": request_id,
            "agentId": agent_id,
            "type": "plan_confirm",
            "toolName": "ExitPlanMode",
            "toolInput": {},
        })

    async def _run_sdk_turn(self, agent_id: str, sdk: Any, prompt: str) -> None:
        agent = self._agents.get(agent_id)
        tracker = self._trackers.get(agent_id)
        if not agent or not tracker:
            return

        # Stream messages via a thread-safe queue
        msg_queue: queue.Queue = queue.Queue()

        continue_conv = agent.turn_count > 0
        agent.turn_count += 1

        # Create PreToolUse hook for permission confirmation via UI.
        # Hooks are enabled for both "default" (tool permission) and "plan" (AskUserQuestion relay).
        # Only "acceptEdits"/"bypassPermissions" skip hooks entirely.
        use_hooks = agent.permission_mode in ("default", "plan")
        pre_tool_hook = self._make_pre_tool_hook(agent_id) if use_hooks else None

        print(f"[AgentManager] Spawning SDK thread for {agent.name} (continue={continue_conv}, hooks={pre_tool_hook is not None})...")
        thread = threading.Thread(
            target=_run_sdk_in_thread,
            args=(sdk, prompt, agent.work_directory, msg_queue, agent.permission_mode, continue_conv, pre_tool_hook),
            daemon=True,
        )
        thread.start()

        # Read from queue without blocking the event loop
        loop = asyncio.get_event_loop()
        got_result = False
        while True:
            try:
                message = await loop.run_in_executor(
                    None, lambda: msg_queue.get(timeout=2.0)
                )
            except queue.Empty:
                if not thread.is_alive():
                    break
                continue

            if message is _SENTINEL:
                break
            if isinstance(message, Exception):
                raise message
            if agent_id not in self._agents or agent_id in self._cancelled:
                break
            if isinstance(message, sdk.ResultMessage):
                got_result = True
            await self._process_message(agent_id, sdk, message)

        print(f"[AgentManager] SDK query finished for {agent.name}")

        if not got_result:
            print(f"[AgentManager] No ResultMessage received for {agent.name}")

    async def _process_message(self, agent_id: str, sdk: Any, message: Any) -> None:
        agent = self._agents.get(agent_id)
        tracker = self._trackers.get(agent_id)
        if not agent or not tracker:
            return

        if isinstance(message, sdk.AssistantMessage):
            for block in message.content:
                if isinstance(block, sdk.TextBlock):
                    if block.text:
                        tracker.on_assistant_text()
                        entry = ConversationEntry(
                            timestamp=time.time() * 1000,
                            role="assistant",
                            content=block.text,
                        )
                        agent.conversation_log.append(entry)
                        await self.sio.emit("agent_conversation", {
                            "agentId": agent_id,
                            "entry": entry.to_dict(),
                        })
                elif isinstance(block, sdk.ToolUseBlock):
                    tool_name = block.name
                    tool_input = block.input if isinstance(block.input, dict) else {}
                    if tool_name:
                        tracker.on_tool_use(tool_name, tool_input)
                        entry = ConversationEntry(
                            timestamp=time.time() * 1000,
                            role="tool",
                            content=f"Using {tool_name}",
                            tool_name=tool_name,
                        )
                        agent.conversation_log.append(entry)
                        await self.sio.emit("agent_conversation", {
                            "agentId": agent_id,
                            "entry": entry.to_dict(),
                        })

                        # Detect plan mode changes
                        if tool_name == "EnterPlanMode":
                            agent.permission_mode = "plan"
                            tracker.on_plan_mode()
                            await self.sio.emit("agent_permission_mode_changed", {
                                "agentId": agent_id,
                                "permissionMode": "plan",
                            })
                        elif tool_name == "ExitPlanMode":
                            # Don't change permissionMode or emit immediately.
                            # Set flag for deferred plan_confirm after turn ends,
                            # so all plan text is visible before the card appears.
                            self._plan_confirm_pending.add(agent_id)

                        # Detect sub-agent spawning
                        if tool_name == "Agent":
                            sub_name = tool_input.get("name", "sub-agent")
                            sub_desc = tool_input.get("description", "")
                            sub_id = f"sub-{uuid.uuid4().hex[:8]}"
                            sub = SubAgentInfo(
                                id=sub_id,
                                name=sub_name,
                                description=sub_desc,
                                parent_id=agent_id,
                            )
                            agent.sub_agents.append(sub)
                            await self.sio.emit("agent_sub_spawned", {
                                "agentId": agent_id,
                                "subAgent": sub.to_dict(),
                            })
                else:
                    block_type = type(block).__name__
                    if block_type != "ThinkingBlock":
                        print(f"[AgentManager] Unhandled block type: {block_type}")

        elif isinstance(message, sdk.ResultMessage):
            if message.is_error:
                entry = ConversationEntry(
                    timestamp=time.time() * 1000,
                    role="system",
                    content=f"Error: {message.result or 'Unknown error'}",
                )
                agent.conversation_log.append(entry)
                await self.sio.emit("agent_conversation", {
                    "agentId": agent_id,
                    "entry": entry.to_dict(),
                })
                tracker.on_error(message.result or "Unknown error")
            else:
                cost = message.total_cost_usd
                cost_str = f"${cost:.4f}" if cost else "?"
                entry = ConversationEntry(
                    timestamp=time.time() * 1000,
                    role="system",
                    content=f"Done ({message.num_turns} turns, {cost_str})",
                )
                agent.conversation_log.append(entry)
                await self.sio.emit("agent_conversation", {
                    "agentId": agent_id,
                    "entry": entry.to_dict(),
                })
