"""Shared type definitions for clawd-office server."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

AgentState = Literal[
    "coding",
    "running_command",
    "searching",
    "planning",
    "waiting_for_user",
    "thinking",
    "idle",
    "error",
]


@dataclass
class Position:
    x: int
    y: int


@dataclass
class ConversationEntry:
    timestamp: float
    role: Literal["user", "assistant", "tool", "system"]
    content: str
    tool_name: str | None = None

    def to_dict(self) -> dict:
        d: dict = {
            "timestamp": self.timestamp,
            "role": self.role,
            "content": self.content,
        }
        if self.tool_name:
            d["toolName"] = self.tool_name
        return d


@dataclass
class SubAgentInfo:
    id: str
    name: str
    description: str
    parent_id: str

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "parentId": self.parent_id,
        }


@dataclass
class AgentInfo:
    id: str
    name: str
    state: AgentState = "idle"
    current_action: str = ""
    desk_index: int = 0
    color: str | None = None
    conversation_log: list[ConversationEntry] = field(default_factory=list)
    error: str | None = None
    work_directory: str | None = None
    git_branch: str | None = None
    sub_agents: list[SubAgentInfo] = field(default_factory=list)
    prompt_queue: list[str] = field(default_factory=list)
    busy: bool = False
    permission_mode: str = "default"
    allowed_tools: set[str] = field(default_factory=set)
    turn_count: int = 0

    def to_client_dict(self) -> dict:
        """Serialize for sending to the client via Socket.IO."""
        d: dict = {
            "id": self.id,
            "name": self.name,
            "state": self.state,
            "currentAction": self.current_action,
            "deskIndex": self.desk_index,
            "color": self.color,
            "conversationLog": [e.to_dict() for e in self.conversation_log],
            "subAgents": [s.to_dict() for s in self.sub_agents],
            "permissionMode": self.permission_mode,
            "allowedTools": sorted(self.allowed_tools),
        }
        if self.error:
            d["error"] = self.error
        if self.work_directory:
            d["workDirectory"] = self.work_directory
        if self.git_branch:
            d["gitBranch"] = self.git_branch
        return d


# Office layout constants
TILE_SIZE = 16
MAP_COLS = 32
MAP_ROWS = 24

DESK_POSITIONS: list[Position] = [
    Position(4, 16),
    Position(11, 16),
    Position(18, 16),
    Position(4, 20),
    Position(11, 20),
]

USER_DESK = Position(18, 20)
MEETING_ROOM = Position(5, 5)
SHARED_SPACE = Position(23, 5)

MAX_DESKS = len(DESK_POSITIONS)

STATE_LABELS: dict[str, str] = {
    "coding": "Coding",
    "running_command": "Running",
    "searching": "Searching",
    "planning": "Planning",
    "waiting_for_user": "Waiting",
    "thinking": "Thinking",
    "idle": "Idle",
    "error": "Error",
}
