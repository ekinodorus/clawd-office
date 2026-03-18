"""Agent state tracking: infer state from tool usage."""

from __future__ import annotations

import asyncio
from typing import Callable

from src.models import AgentState

IDLE_TIMEOUT_S = 30.0


def infer_state(tool_name: str) -> AgentState:
    """Map a tool name to the agent state it implies."""
    match tool_name:
        case "Edit" | "Write" | "NotebookEdit":
            return "coding"
        case "Bash":
            return "running_command"
        case "Grep" | "Glob" | "Read" | "WebSearch" | "WebFetch":
            return "searching"
        case "AskUserQuestion":
            return "waiting_for_user"
        case _:
            return "coding"


def describe_action(tool_name: str, tool_input: dict) -> str:
    """Derive a human-readable action string from a tool invocation."""
    match tool_name:
        case "Edit":
            return "Editing file"
        case "Write":
            return "Writing file"
        case "Read":
            return "Reading file"
        case "NotebookEdit":
            return "Editing notebook"
        case "Bash":
            return "Running command"
        case "Grep":
            return "Searching code"
        case "Glob":
            return "Searching files"
        case "WebSearch":
            return "Web search"
        case "WebFetch":
            return "Fetching page"
        case "AskUserQuestion":
            questions = tool_input.get("questions", [])
            if questions and isinstance(questions, list):
                return "Asking user"
            return "Waiting for answer"
        case "Agent":
            return "Spawning sub-agent"
        case _:
            return "Working..."


class AgentStateTracker:
    """Tracks the state of a single agent over time."""

    def __init__(self) -> None:
        self._state: AgentState = "idle"
        self._current_action: str = ""
        self._on_change: Callable[[AgentState, str], None] | None = None
        self._idle_task: asyncio.Task | None = None
        self._turn_active: bool = False

    @property
    def state(self) -> AgentState:
        return self._state

    @property
    def current_action(self) -> str:
        return self._current_action

    def on_change(self, cb: Callable[[AgentState, str], None]) -> None:
        self._on_change = cb

    def on_user_message(self) -> None:
        self._turn_active = True
        self._transition("thinking", "Thinking...")

    def on_assistant_text(self) -> None:
        if self._state not in ("thinking", "idle", "error", "waiting_for_user"):
            self._transition("thinking", "Thinking...")
        else:
            self._touch()

    def on_tool_use(self, tool_name: str, tool_input: dict) -> None:
        new_state = infer_state(tool_name)
        action = describe_action(tool_name, tool_input)
        self._transition(new_state, action)

    def on_turn_complete(self) -> None:
        self._turn_active = False
        self._transition("idle", "")

    def on_plan_mode(self) -> None:
        self._transition("planning", "Planning...")

    def on_waiting_for_user(self) -> None:
        self._transition("waiting_for_user", "Waiting for input")

    def on_error(self, message: str) -> None:
        self._turn_active = False
        self._transition("error", message)

    def dispose(self) -> None:
        self._on_change = None
        if self._idle_task and not self._idle_task.done():
            self._idle_task.cancel()
            self._idle_task = None

    def _touch(self) -> None:
        self._reset_idle_timer()

    def _transition(self, state: AgentState, action: str) -> None:
        self._touch()
        changed = self._state != state or self._current_action != action
        self._state = state
        self._current_action = action
        if changed and self._on_change:
            self._on_change(state, action)

    def _reset_idle_timer(self) -> None:
        if self._idle_task and not self._idle_task.done():
            self._idle_task.cancel()
        if self._state not in ("idle", "error", "waiting_for_user"):
            self._idle_task = asyncio.ensure_future(self._idle_countdown())

    async def _idle_countdown(self) -> None:
        try:
            await asyncio.sleep(IDLE_TIMEOUT_S)
            if self._on_change is None:
                return  # Tracker was disposed
            if self._turn_active:
                self._transition("thinking", "Thinking...")
            else:
                self._transition("idle", "")
        except asyncio.CancelledError:
            pass
