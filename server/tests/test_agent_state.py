"""Tests for server/src/agent_state.py"""

import pytest

from src.agent_state import AgentStateTracker, infer_state, describe_action


class TestInferState:
    @pytest.mark.parametrize("tool,expected", [
        ("Edit", "coding"),
        ("Write", "coding"),
        ("NotebookEdit", "coding"),
        ("Bash", "running_command"),
        ("Grep", "searching"),
        ("Glob", "searching"),
        ("Read", "searching"),
        ("WebSearch", "searching"),
        ("WebFetch", "searching"),
    ])
    def test_known_tools(self, tool: str, expected: str):
        assert infer_state(tool) == expected

    def test_ask_user_question_maps_to_waiting(self):
        assert infer_state("AskUserQuestion") == "waiting_for_user"

    def test_unknown_tool_defaults_to_coding(self):
        assert infer_state("UnknownTool") == "coding"


class TestDescribeAction:
    def test_edit_file(self):
        result = describe_action("Edit", {"file_path": "/src/main.ts"})
        assert result == "Editing file"

    def test_write_file(self):
        result = describe_action("Write", {"file_path": "/src/new.ts"})
        assert result == "Writing file"

    def test_read_file(self):
        result = describe_action("Read", {"file_path": "/src/main.ts"})
        assert result == "Reading file"

    def test_bash_command(self):
        result = describe_action("Bash", {"command": "cd /path/to/project && npm test"})
        assert result == "Running command"

    def test_grep(self):
        result = describe_action("Grep", {"pattern": "TODO"})
        assert result == "Searching code"

    def test_glob(self):
        result = describe_action("Glob", {"pattern": "**/*.ts"})
        assert result == "Searching files"

    def test_web_search(self):
        result = describe_action("WebSearch", {"query": "react hooks"})
        assert result == "Web search"

    def test_web_fetch(self):
        result = describe_action("WebFetch", {"url": "https://example.com"})
        assert result == "Fetching page"

    def test_notebook_edit(self):
        result = describe_action("NotebookEdit", {"notebook_path": "/nb.ipynb"})
        assert result == "Editing notebook"

    def test_ask_user_question(self):
        result = describe_action("AskUserQuestion", {
            "questions": [{"question": "Which approach?", "options": []}]
        })
        assert result == "Asking user"

    def test_ask_user_question_no_questions(self):
        result = describe_action("AskUserQuestion", {})
        assert result == "Waiting for answer"

    def test_agent_tool(self):
        result = describe_action("Agent", {"description": "research"})
        assert result == "Spawning sub-agent"

    def test_unknown_tool_returns_working(self):
        result = describe_action("SomeTool", {})
        assert result == "Working..."


class TestAgentStateTracker:
    def test_initial_state_is_idle(self):
        tracker = AgentStateTracker()
        assert tracker.state == "idle"
        tracker.dispose()

    def test_on_user_message_transitions_to_thinking(self):
        tracker = AgentStateTracker()
        changes: list[tuple[str, str]] = []
        tracker.on_change(lambda s, a: changes.append((s, a)))

        tracker.on_user_message()
        assert tracker.state == "thinking"
        assert len(changes) == 1
        tracker.dispose()

    def test_on_tool_use_transitions_state(self):
        tracker = AgentStateTracker()
        tracker.on_user_message()

        tracker.on_tool_use("Edit", {"file_path": "/foo.py"})
        assert tracker.state == "coding"
        tracker.dispose()

    def test_on_turn_complete_returns_to_idle(self):
        tracker = AgentStateTracker()
        tracker.on_user_message()
        tracker.on_turn_complete()
        assert tracker.state == "idle"
        tracker.dispose()

    def test_on_error_transitions_to_error(self):
        tracker = AgentStateTracker()
        tracker.on_error("boom")
        assert tracker.state == "error"
        tracker.dispose()

    def test_assistant_text_after_tool_transitions_to_thinking(self):
        """After a tool use, assistant text should transition back to thinking."""
        tracker = AgentStateTracker()
        changes: list[tuple[str, str]] = []
        tracker.on_change(lambda s, a: changes.append((s, a)))

        tracker.on_user_message()
        tracker.on_tool_use("Grep", {"pattern": "TODO"})
        assert tracker.state == "searching"

        tracker.on_assistant_text()
        assert tracker.state == "thinking"
        tracker.dispose()

    def test_assistant_text_stays_thinking_if_already_thinking(self):
        """If already thinking, assistant text should not emit duplicate change."""
        tracker = AgentStateTracker()
        tracker.on_user_message()
        assert tracker.state == "thinking"

        changes: list[tuple[str, str]] = []
        tracker.on_change(lambda s, a: changes.append((s, a)))

        tracker.on_assistant_text()
        assert tracker.state == "thinking"
        assert len(changes) == 0  # no duplicate emission
        tracker.dispose()

    @pytest.mark.asyncio
    async def test_idle_timer_shows_thinking_during_active_turn(self):
        """During an active turn, the idle timeout should show thinking, not idle."""
        import asyncio
        from src.agent_state import IDLE_TIMEOUT_S

        tracker = AgentStateTracker()
        changes: list[tuple[str, str]] = []
        tracker.on_change(lambda s, a: changes.append((s, a)))

        tracker.on_user_message()
        tracker.on_tool_use("Edit", {"file_path": "/foo.py"})

        # Simulate idle timeout firing (use short sleep with patched timeout)
        import unittest.mock
        with unittest.mock.patch("src.agent_state.IDLE_TIMEOUT_S", 0.05):
            # Reset timer with short timeout
            tracker._reset_idle_timer()
            await asyncio.sleep(0.1)

        # Should be thinking (not idle) because turn is active
        assert tracker.state == "thinking"
        tracker.dispose()

    @pytest.mark.asyncio
    async def test_idle_timer_goes_idle_after_turn_complete(self):
        """After turn completes, the idle timeout should go to idle normally."""
        tracker = AgentStateTracker()
        tracker.on_user_message()
        tracker.on_turn_complete()
        assert tracker.state == "idle"
        tracker.dispose()

    def test_on_error_clears_turn_active(self):
        """Error should clear turn_active so idle timer works normally after."""
        tracker = AgentStateTracker()
        tracker.on_user_message()
        tracker.on_error("boom")
        assert tracker.state == "error"
        # turn_active should be cleared
        assert not tracker._turn_active
        tracker.dispose()


class TestOnPlanMode:
    def test_on_plan_mode_transitions_to_planning(self):
        tracker = AgentStateTracker()
        tracker.on_plan_mode()
        assert tracker.state == "planning"
        assert tracker.current_action == "Planning..."
        tracker.dispose()


class TestOnWaitingForUser:
    def test_on_waiting_for_user_transitions(self):
        tracker = AgentStateTracker()
        tracker.on_waiting_for_user()
        assert tracker.state == "waiting_for_user"
        assert tracker.current_action == "Waiting for input"
        tracker.dispose()


class TestDispose:
    @pytest.mark.asyncio
    async def test_dispose_cancels_idle_timer(self):
        import asyncio
        import unittest.mock

        tracker = AgentStateTracker()
        tracker.on_user_message()
        tracker.on_tool_use("Edit", {"file_path": "/foo.py"})

        # Ensure an idle timer task exists
        with unittest.mock.patch("src.agent_state.IDLE_TIMEOUT_S", 10.0):
            tracker._reset_idle_timer()

        assert tracker._idle_task is not None
        idle_task = tracker._idle_task

        tracker.dispose()
        # Give the event loop a tick so the cancellation propagates
        await asyncio.sleep(0)
        assert idle_task.cancelled() or idle_task.done()
        assert tracker._idle_task is None
