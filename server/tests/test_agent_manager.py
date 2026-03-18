"""Tests for server/src/agent_manager.py — permission system."""

import asyncio
import threading
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
import socketio

from src.agent_manager import AgentManager


@pytest.fixture
def mock_sio():
    sio = AsyncMock(spec=socketio.AsyncServer)
    sio.emit = AsyncMock()
    return sio


@pytest.fixture
def manager(mock_sio):
    return AgentManager(mock_sio)


class TestPermissionSystem:
    @pytest.mark.asyncio
    async def test_resolve_permission_sets_result(self, manager):
        """resolve_permission should set the result on the pending entry."""
        agent = await manager.add_agent("Test")
        agent_id = agent.id

        # Simulate a pending permission request with threading.Event
        t_event = threading.Event()
        request_id = "req-1"
        manager._pending_permissions[request_id] = {
            "event": t_event,
            "agent_id": agent_id,
            "result": None,
        }

        answers = {"allowed": "true"}
        manager.resolve_permission(request_id, answers)

        assert t_event.is_set()
        assert manager._pending_permissions[request_id]["result"] == answers

    @pytest.mark.asyncio
    async def test_resolve_permission_unknown_id(self, manager):
        """resolve_permission with unknown id should not raise."""
        manager.resolve_permission("nonexistent", {})

    @pytest.mark.asyncio
    async def test_pending_permissions_cleared_on_remove(self, manager):
        agent = await manager.add_agent("Test")
        agent_id = agent.id

        t_event = threading.Event()
        request_id = "req-2"
        manager._pending_permissions[request_id] = {
            "event": t_event,
            "agent_id": agent_id,
            "result": None,
        }

        await manager.remove_agent(agent_id)
        assert request_id not in manager._pending_permissions
        assert t_event.is_set()

    @pytest.mark.asyncio
    async def test_pending_permissions_denied_on_abort(self, manager):
        agent = await manager.add_agent("Test")
        agent_id = agent.id

        t_event = threading.Event()
        request_id = "req-3"
        manager._pending_permissions[request_id] = {
            "event": t_event,
            "agent_id": agent_id,
            "result": None,
        }

        await manager.abort_agent(agent_id)
        assert request_id not in manager._pending_permissions
        assert t_event.is_set()

    @pytest.mark.asyncio
    async def test_main_loop_stored(self, manager):
        """Manager should store a reference to the main event loop."""
        assert manager._main_loop is not None


class TestUpdateColor:
    @pytest.mark.asyncio
    async def test_update_color(self, manager, mock_sio):
        agent = await manager.add_agent("Test", color="#5b6ee1")
        result = await manager.update_color(agent.id, "#d95763")
        assert result is True
        assert manager._agents[agent.id].color == "#d95763"
        mock_sio.emit.assert_any_call(
            "agent_color_changed",
            {"agentId": agent.id, "color": "#d95763"},
        )

    @pytest.mark.asyncio
    async def test_update_color_unknown_agent(self, manager):
        result = await manager.update_color("nonexistent", "#d95763")
        assert result is False


class TestAbortAgent:
    @pytest.mark.asyncio
    async def test_abort_agent_sets_cancelled(self, manager):
        agent = await manager.add_agent("Test")
        await manager.abort_agent(agent.id)
        assert agent.id in manager._cancelled

    @pytest.mark.asyncio
    async def test_abort_unknown_agent(self, manager):
        result = await manager.abort_agent("nonexistent")
        assert result is False

    @pytest.mark.asyncio
    async def test_abort_clears_prompt_queue(self, manager):
        agent = await manager.add_agent("Test")
        agent.prompt_queue.append("pending prompt")
        await manager.abort_agent(agent.id)
        assert agent.prompt_queue == []

    @pytest.mark.asyncio
    async def test_abort_emits_event(self, manager, mock_sio):
        agent = await manager.add_agent("Test")
        await manager.abort_agent(agent.id)
        mock_sio.emit.assert_any_call(
            "agent_aborted",
            {"agentId": agent.id},
        )

    @pytest.mark.asyncio
    async def test_remove_agent_cancels_running(self, manager):
        agent = await manager.add_agent("Test")
        await manager.remove_agent(agent.id)
        assert agent.id in manager._cancelled


class TestUpdatePermissionMode:
    @pytest.mark.asyncio
    async def test_update_permission_mode(self, manager, mock_sio):
        agent = await manager.add_agent("Test")
        assert manager._agents[agent.id].permission_mode == "default"

        result = await manager.update_permission_mode(agent.id, "acceptEdits")
        assert result is True
        assert manager._agents[agent.id].permission_mode == "acceptEdits"
        mock_sio.emit.assert_any_call(
            "agent_permission_mode_changed",
            {"agentId": agent.id, "permissionMode": "acceptEdits"},
        )

    @pytest.mark.asyncio
    async def test_update_permission_mode_unknown_agent(self, manager):
        result = await manager.update_permission_mode("nonexistent", "plan")
        assert result is False

    @pytest.mark.asyncio
    async def test_add_agent_default_permission_mode(self, manager):
        agent = await manager.add_agent("Test")
        assert manager._agents[agent.id].permission_mode == "default"

    @pytest.mark.asyncio
    async def test_permission_mode_in_snapshot(self, manager):
        agent = await manager.add_agent("Test")
        agents = manager.get_agents()
        assert agents[0]["permissionMode"] == "default"


class TestUpdateAllowedTools:
    @pytest.mark.asyncio
    async def test_update_allowed_tools(self, manager, mock_sio):
        agent = await manager.add_agent("Test")
        result = await manager.update_allowed_tools(agent.id, {"Bash", "Edit"})
        assert result is True
        assert manager._agents[agent.id].allowed_tools == {"Bash", "Edit"}
        mock_sio.emit.assert_any_call(
            "agent_allowed_tools_changed",
            {"agentId": agent.id, "allowedTools": sorted(["Bash", "Edit"])},
        )

    @pytest.mark.asyncio
    async def test_update_allowed_tools_unknown_agent(self, manager):
        result = await manager.update_allowed_tools("nonexistent", {"Bash"})
        assert result is False

    @pytest.mark.asyncio
    async def test_update_allowed_tools_empty_set(self, manager, mock_sio):
        agent = await manager.add_agent("Test")
        agent.allowed_tools = {"Bash"}
        result = await manager.update_allowed_tools(agent.id, set())
        assert result is True
        assert manager._agents[agent.id].allowed_tools == set()


def _make_sdk():
    """Create a fake SDK module with message/block types."""
    class TextBlock:
        def __init__(self, text=""):
            self.text = text

    class ToolUseBlock:
        def __init__(self, name="", input=None):
            self.name = name
            self.input = input or {}

    class AssistantMessage:
        def __init__(self, content=None):
            self.content = content or []

    class ResultMessage:
        def __init__(self, is_error=False, result=None):
            self.is_error = is_error
            self.result = result

    sdk = SimpleNamespace(
        TextBlock=TextBlock,
        ToolUseBlock=ToolUseBlock,
        AssistantMessage=AssistantMessage,
        ResultMessage=ResultMessage,
    )
    return sdk


class TestAddAgent:
    @pytest.mark.asyncio
    async def test_add_agent_returns_agent_info(self, manager):
        agent = await manager.add_agent("Alice")
        assert agent.id is not None
        assert agent.name == "Alice"
        assert isinstance(agent.desk_index, int)
        assert agent.state == "idle"

    @pytest.mark.asyncio
    async def test_add_agent_emits_agent_added(self, manager, mock_sio):
        agent = await manager.add_agent("Bob")
        mock_sio.emit.assert_any_call("agent_added", agent.to_client_dict())

    @pytest.mark.asyncio
    async def test_add_agent_with_color(self, manager):
        agent = await manager.add_agent("Carol", color="#ff0000")
        assert agent.color == "#ff0000"

    @pytest.mark.asyncio
    async def test_add_agent_creates_tracker(self, manager):
        agent = await manager.add_agent("Dave")
        assert agent.id in manager._trackers

    @pytest.mark.asyncio
    async def test_add_agent_increments_desk_index(self, manager):
        a1 = await manager.add_agent("E1")
        a2 = await manager.add_agent("E2")
        assert a2.desk_index == (a1.desk_index + 1) % 5  # MAX_DESKS=5


class TestRenameAgent:
    @pytest.mark.asyncio
    async def test_rename_agent(self, manager, mock_sio):
        agent = await manager.add_agent("OldName")
        result = await manager.rename_agent(agent.id, "NewName")
        assert result is True
        assert manager._agents[agent.id].name == "NewName"
        mock_sio.emit.assert_any_call(
            "agent_renamed", {"agentId": agent.id, "name": "NewName"}
        )

    @pytest.mark.asyncio
    async def test_rename_unknown_agent(self, manager):
        result = await manager.rename_agent("nonexistent", "Name")
        assert result is False


class TestRemoveAgent:
    @pytest.mark.asyncio
    async def test_remove_agent(self, manager, mock_sio):
        agent = await manager.add_agent("ToRemove")
        result = await manager.remove_agent(agent.id)
        assert result is True
        assert agent.id not in manager._agents
        mock_sio.emit.assert_any_call(
            "agent_removed", {"agentId": agent.id}
        )

    @pytest.mark.asyncio
    async def test_remove_unknown_agent(self, manager):
        result = await manager.remove_agent("nonexistent")
        assert result is False

    @pytest.mark.asyncio
    async def test_remove_cleans_up_tracker(self, manager):
        agent = await manager.add_agent("Tracked")
        assert agent.id in manager._trackers
        await manager.remove_agent(agent.id)
        assert agent.id not in manager._trackers


class TestGetAgents:
    @pytest.mark.asyncio
    async def test_get_agents_empty(self, manager):
        assert manager.get_agents() == []

    @pytest.mark.asyncio
    async def test_get_agents_returns_all(self, manager):
        await manager.add_agent("A")
        await manager.add_agent("B")
        agents = manager.get_agents()
        assert len(agents) == 2

    @pytest.mark.asyncio
    async def test_get_agent_by_id(self, manager):
        agent = await manager.add_agent("FindMe")
        found = manager.get_agent(agent.id)
        assert found is not None
        assert found["id"] == agent.id
        assert found["name"] == "FindMe"

    @pytest.mark.asyncio
    async def test_get_agent_unknown_returns_none(self, manager):
        assert manager.get_agent("nonexistent") is None


class TestUpdateDirectory:
    @pytest.mark.asyncio
    async def test_update_directory(self, manager, mock_sio):
        agent = await manager.add_agent("DirAgent")
        result = await manager.update_directory(agent.id, "/tmp/project")
        assert result is True
        assert manager._agents[agent.id].work_directory == "/tmp/project"
        mock_sio.emit.assert_any_call(
            "agent_directory_changed",
            {
                "agentId": agent.id,
                "workDirectory": "/tmp/project",
                "gitBranch": agent.git_branch,
            },
        )

    @pytest.mark.asyncio
    async def test_update_directory_unknown_agent(self, manager):
        result = await manager.update_directory("nonexistent", "/tmp")
        assert result is False

    @pytest.mark.asyncio
    async def test_update_directory_clears_git_branch_when_none(self, manager):
        agent = await manager.add_agent("BranchAgent")
        agent.git_branch = "main"
        result = await manager.update_directory(agent.id, None)
        assert result is True
        assert agent.git_branch is None


class TestSendPrompt:
    @pytest.mark.asyncio
    async def test_send_prompt_unknown_agent_does_not_crash(self, manager):
        # Should not raise any exception
        await manager.send_prompt("nonexistent", "hello")


class TestProcessMessage:
    @pytest.mark.asyncio
    async def test_process_text_block_emits_conversation(self, manager, mock_sio):
        agent = await manager.add_agent("TextAgent")
        sdk = _make_sdk()
        msg = sdk.AssistantMessage(content=[sdk.TextBlock(text="Hello world")])
        await manager._process_message(agent.id, sdk, msg)

        calls = [c for c in mock_sio.emit.call_args_list if c[0][0] == "agent_conversation"]
        # Find the one with assistant role
        assistant_calls = [c for c in calls if c[0][1]["entry"]["role"] == "assistant"]
        assert len(assistant_calls) >= 1
        assert assistant_calls[-1][0][1]["entry"]["content"] == "Hello world"

    @pytest.mark.asyncio
    async def test_process_tool_use_block_emits_conversation(self, manager, mock_sio):
        agent = await manager.add_agent("ToolAgent")
        sdk = _make_sdk()
        msg = sdk.AssistantMessage(content=[sdk.ToolUseBlock(name="Edit", input={})])
        await manager._process_message(agent.id, sdk, msg)

        calls = [c for c in mock_sio.emit.call_args_list if c[0][0] == "agent_conversation"]
        tool_calls = [c for c in calls if c[0][1]["entry"]["role"] == "tool"]
        assert len(tool_calls) >= 1
        assert "Edit" in tool_calls[-1][0][1]["entry"]["content"]

    @pytest.mark.asyncio
    async def test_process_result_message_success(self, manager, mock_sio):
        agent = await manager.add_agent("ResultAgent")
        sdk = _make_sdk()

        # Add cost attributes for ResultMessage
        class SuccessResult:
            is_error = False
            result = "All done"
            total_cost_usd = 0.0123
            num_turns = 3

        msg = SuccessResult()
        # Patch isinstance check: sdk.ResultMessage must match
        sdk.ResultMessage = type(msg)
        await manager._process_message(agent.id, sdk, msg)

        calls = [c for c in mock_sio.emit.call_args_list if c[0][0] == "agent_conversation"]
        system_calls = [c for c in calls if c[0][1]["entry"]["role"] == "system"]
        assert len(system_calls) >= 1
        assert "Done" in system_calls[-1][0][1]["entry"]["content"]

    @pytest.mark.asyncio
    async def test_process_result_message_error(self, manager, mock_sio):
        agent = await manager.add_agent("ErrorAgent")
        sdk = _make_sdk()

        class ErrorResult:
            is_error = True
            result = "Something failed"

        msg = ErrorResult()
        sdk.ResultMessage = type(msg)
        await manager._process_message(agent.id, sdk, msg)

        calls = [c for c in mock_sio.emit.call_args_list if c[0][0] == "agent_conversation"]
        system_calls = [c for c in calls if c[0][1]["entry"]["role"] == "system"]
        assert len(system_calls) >= 1
        assert "Error" in system_calls[-1][0][1]["entry"]["content"]

    @pytest.mark.asyncio
    async def test_process_agent_tool_spawns_sub_agent(self, manager, mock_sio):
        agent = await manager.add_agent("ParentAgent")
        sdk = _make_sdk()
        msg = sdk.AssistantMessage(content=[
            sdk.ToolUseBlock(name="Agent", input={"name": "helper", "description": "Research"})
        ])
        await manager._process_message(agent.id, sdk, msg)

        assert len(agent.sub_agents) == 1
        assert agent.sub_agents[0].name == "helper"
        mock_sio.emit.assert_any_call(
            "agent_sub_spawned",
            {"agentId": agent.id, "subAgent": agent.sub_agents[0].to_dict()},
        )

    @pytest.mark.asyncio
    async def test_process_unknown_agent_does_not_crash(self, manager):
        sdk = _make_sdk()
        msg = sdk.AssistantMessage(content=[sdk.TextBlock(text="orphan")])
        # Should not raise
        await manager._process_message("nonexistent", sdk, msg)


class TestCancelledHook:
    @pytest.mark.asyncio
    async def test_cancelled_agent_blocks_all_tools(self, manager):
        agent = await manager.add_agent("CancelMe")
        manager._cancelled.add(agent.id)
        hook = manager._make_pre_tool_hook(agent.id)

        result = await hook({"tool_name": "Write", "tool_input": {}}, None, None)
        assert result["decision"] == "block"

        result = await hook({"tool_name": "Read", "tool_input": {}}, None, None)
        assert result["decision"] == "block"

        result = await hook({"tool_name": "Bash", "tool_input": {}}, None, None)
        assert result["decision"] == "block"


class TestModeDetectionFromStream:
    """Detect EnterPlanMode / ExitPlanMode tool use and update permission_mode."""

    @pytest.mark.asyncio
    async def test_enter_plan_mode_sets_permission_plan(self, manager, mock_sio):
        agent = await manager.add_agent("Test")
        sdk = _make_sdk()

        msg = sdk.AssistantMessage(content=[
            sdk.ToolUseBlock(name="EnterPlanMode", input={}),
        ])
        await manager._process_message(agent.id, sdk, msg)

        assert manager._agents[agent.id].permission_mode == "plan"

    @pytest.mark.asyncio
    async def test_enter_plan_mode_emits_event(self, manager, mock_sio):
        agent = await manager.add_agent("Test")
        sdk = _make_sdk()

        msg = sdk.AssistantMessage(content=[
            sdk.ToolUseBlock(name="EnterPlanMode", input={}),
        ])
        await manager._process_message(agent.id, sdk, msg)

        mock_sio.emit.assert_any_call(
            "agent_permission_mode_changed",
            {"agentId": agent.id, "permissionMode": "plan"},
        )

    @pytest.mark.asyncio
    async def test_enter_plan_mode_transitions_state_to_planning(self, manager, mock_sio):
        agent = await manager.add_agent("Test")
        sdk = _make_sdk()

        msg = sdk.AssistantMessage(content=[
            sdk.ToolUseBlock(name="EnterPlanMode", input={}),
        ])
        await manager._process_message(agent.id, sdk, msg)

        tracker = manager._trackers[agent.id]
        assert tracker.state == "planning"

    @pytest.mark.asyncio
    async def test_exit_plan_mode_does_not_change_permission_immediately(self, manager, mock_sio):
        """ExitPlanMode should NOT immediately change permissionMode to default."""
        agent = await manager.add_agent("Test")
        agent.permission_mode = "plan"
        sdk = _make_sdk()

        msg = sdk.AssistantMessage(content=[
            sdk.ToolUseBlock(name="ExitPlanMode", input={}),
        ])
        await manager._process_message(agent.id, sdk, msg)

        # permissionMode should still be "plan" (not changed to "default")
        assert manager._agents[agent.id].permission_mode == "plan"

    @pytest.mark.asyncio
    async def test_exit_plan_mode_sets_pending_flag(self, manager, mock_sio):
        """ExitPlanMode should set a flag for deferred plan_confirm emission."""
        agent = await manager.add_agent("Test")
        agent.permission_mode = "plan"
        sdk = _make_sdk()

        msg = sdk.AssistantMessage(content=[
            sdk.ToolUseBlock(name="ExitPlanMode", input={}),
        ])
        await manager._process_message(agent.id, sdk, msg)

        assert agent.id in manager._plan_confirm_pending

    @pytest.mark.asyncio
    async def test_exit_plan_mode_does_not_emit_immediately(self, manager, mock_sio):
        """ExitPlanMode should NOT emit plan_confirm during _process_message."""
        agent = await manager.add_agent("Test")
        agent.permission_mode = "plan"
        sdk = _make_sdk()

        msg = sdk.AssistantMessage(content=[
            sdk.ToolUseBlock(name="ExitPlanMode", input={}),
        ])
        await manager._process_message(agent.id, sdk, msg)

        # Should NOT emit permission_request yet (deferred to turn end)
        calls = mock_sio.emit.call_args_list
        plan_confirm_calls = [
            c for c in calls
            if c[0][0] == "permission_request"
            and c[0][1].get("type") == "plan_confirm"
        ]
        assert len(plan_confirm_calls) == 0


class TestPlanConfirmDeferred:
    """plan_confirm should be emitted after turn completes, not during message processing."""

    @pytest.mark.asyncio
    async def test_emit_plan_confirm_after_turn(self, manager, mock_sio):
        """_emit_deferred_plan_confirm should emit plan_confirm and clear the flag."""
        agent = await manager.add_agent("Test")
        agent.permission_mode = "plan"
        manager._plan_confirm_pending.add(agent.id)

        await manager._emit_deferred_plan_confirm(agent.id)

        calls = mock_sio.emit.call_args_list
        plan_confirm_calls = [
            c for c in calls
            if c[0][0] == "permission_request"
            and c[0][1].get("type") == "plan_confirm"
        ]
        assert len(plan_confirm_calls) == 1
        payload = plan_confirm_calls[0][0][1]
        assert payload["agentId"] == agent.id
        assert "requestId" in payload
        assert agent.id not in manager._plan_confirm_pending

    @pytest.mark.asyncio
    async def test_no_emit_without_flag(self, manager, mock_sio):
        """_emit_deferred_plan_confirm should do nothing if flag not set."""
        agent = await manager.add_agent("Test")
        mock_sio.emit.reset_mock()

        await manager._emit_deferred_plan_confirm(agent.id)

        plan_confirm_calls = [
            c for c in mock_sio.emit.call_args_list
            if c[0][0] == "permission_request"
        ]
        assert len(plan_confirm_calls) == 0


class TestPreToolHook:
    """Test _make_pre_tool_hook callback."""

    @pytest.mark.asyncio
    async def test_safe_tools_auto_approved(self, manager):
        agent = await manager.add_agent("Test")
        hook = manager._make_pre_tool_hook(agent.id)

        for tool in ["Read", "Glob", "Grep", "Agent", "TaskList"]:
            result = await hook({"tool_name": tool}, None, None)
            assert result == {}, f"{tool} should be auto-approved"

    @pytest.mark.asyncio
    async def test_ask_user_question_not_auto_approved(self, manager, mock_sio):
        """AskUserQuestion should NOT be auto-approved; it needs UI relay."""
        agent = await manager.add_agent("Test")
        hook = manager._make_pre_tool_hook(agent.id)
        manager._main_loop = asyncio.get_event_loop()

        tool_input = {"questions": [{"question": "Which color?", "options": [{"label": "Red"}, {"label": "Blue"}]}]}

        async def run_hook():
            return await hook({"tool_name": "AskUserQuestion", "tool_input": tool_input}, None, None)

        task = asyncio.create_task(run_hook())
        await asyncio.sleep(0.1)

        # Should emit permission_request with type ask_user_question
        assert len(manager._pending_permissions) == 1
        request_id = list(manager._pending_permissions.keys())[0]

        # Simulate user answering
        manager.resolve_permission(request_id, {"q0": "Red"})
        result = await asyncio.wait_for(task, timeout=5.0)

        # Should return block with user's answer in systemMessage
        assert result["decision"] == "block"
        assert "Red" in result["systemMessage"]

    @pytest.mark.asyncio
    async def test_hook_created_for_plan_mode(self, manager):
        """Hooks should be created for plan mode (for AskUserQuestion handling)."""
        agent = await manager.add_agent("Test")
        agent.permission_mode = "plan"
        hook = manager._make_pre_tool_hook(agent.id)
        assert hook is not None

    @pytest.mark.asyncio
    async def test_plan_mode_auto_approves_dangerous_tools(self, manager):
        """In plan mode, dangerous tools like Write should be auto-approved."""
        agent = await manager.add_agent("Test")
        agent.permission_mode = "plan"
        hook = manager._make_pre_tool_hook(agent.id)

        result = await hook({"tool_name": "Write", "tool_input": {}}, None, None)
        assert result == {}, "Plan mode should auto-approve dangerous tools"

    @pytest.mark.asyncio
    async def test_dangerous_tools_request_permission(self, manager, mock_sio):
        agent = await manager.add_agent("Test")
        hook = manager._make_pre_tool_hook(agent.id)

        # Store main loop so emit works
        manager._main_loop = asyncio.get_event_loop()

        # Run hook in background, it will block waiting for permission
        import concurrent.futures
        loop = asyncio.get_event_loop()

        async def run_hook():
            return await hook({"tool_name": "Write", "tool_input": {"file_path": "test.txt"}}, None, None)

        # Start hook (will block on permission)
        task = asyncio.create_task(run_hook())

        # Give it a moment to emit the request
        await asyncio.sleep(0.1)

        # Find the pending permission and resolve it
        assert len(manager._pending_permissions) == 1
        request_id = list(manager._pending_permissions.keys())[0]
        manager.resolve_permission(request_id, {"allowed": "true"})

        result = await asyncio.wait_for(task, timeout=5.0)
        assert result == {}  # Allowed

    @pytest.mark.asyncio
    async def test_allowed_tools_auto_approved(self, manager, mock_sio):
        """Tools in agent.allowed_tools should be auto-approved in default mode."""
        agent = await manager.add_agent("Test")
        agent.allowed_tools = {"Bash", "Write"}
        hook = manager._make_pre_tool_hook(agent.id)

        result = await hook({"tool_name": "Bash", "tool_input": {"command": "ls"}}, None, None)
        assert result == {}, "Bash in allowed_tools should be auto-approved"

        result = await hook({"tool_name": "Write", "tool_input": {"file_path": "test.txt"}}, None, None)
        assert result == {}, "Write in allowed_tools should be auto-approved"

    @pytest.mark.asyncio
    async def test_not_in_allowed_tools_requests_permission(self, manager, mock_sio):
        """Tools NOT in allowed_tools should still request permission."""
        agent = await manager.add_agent("Test")
        agent.allowed_tools = {"Bash"}  # Only Bash is allowed
        hook = manager._make_pre_tool_hook(agent.id)
        manager._main_loop = asyncio.get_event_loop()

        async def run_hook():
            return await hook({"tool_name": "Edit", "tool_input": {}}, None, None)

        task = asyncio.create_task(run_hook())
        await asyncio.sleep(0.1)

        # Edit is NOT in allowed_tools, so it should request permission
        assert len(manager._pending_permissions) == 1
        request_id = list(manager._pending_permissions.keys())[0]
        manager.resolve_permission(request_id, {"allowed": "true"})
        result = await asyncio.wait_for(task, timeout=5.0)
        assert result == {}

    @pytest.mark.asyncio
    async def test_ask_user_question_includes_question_text(self, manager, mock_sio):
        """AskUserQuestion answer should include the question text, not just 'q0'."""
        agent = await manager.add_agent("Test")
        hook = manager._make_pre_tool_hook(agent.id)
        manager._main_loop = asyncio.get_event_loop()

        tool_input = {
            "questions": [
                {"question": "Which color do you prefer?", "options": [{"label": "Red"}, {"label": "Blue"}]},
                {"question": "Which size?", "options": [{"label": "S"}, {"label": "M"}]},
            ]
        }

        async def run_hook():
            return await hook({"tool_name": "AskUserQuestion", "tool_input": tool_input}, None, None)

        task = asyncio.create_task(run_hook())
        await asyncio.sleep(0.1)

        request_id = list(manager._pending_permissions.keys())[0]
        manager.resolve_permission(request_id, {"q0": "Red", "q1": "M"})
        result = await asyncio.wait_for(task, timeout=5.0)

        assert result["decision"] == "block"
        # Should contain the actual question text, not just "q0"
        assert "Which color do you prefer?" in result["systemMessage"]
        assert "Which size?" in result["systemMessage"]
        assert "Red" in result["systemMessage"]
        assert "M" in result["systemMessage"]
        # Should NOT contain raw key "q0"
        assert "q0" not in result["systemMessage"]

    @pytest.mark.asyncio
    async def test_dangerous_tools_denied(self, manager, mock_sio):
        agent = await manager.add_agent("Test")
        hook = manager._make_pre_tool_hook(agent.id)
        manager._main_loop = asyncio.get_event_loop()

        async def run_hook():
            return await hook({"tool_name": "Bash", "tool_input": {"command": "rm -rf /"}}, None, None)

        task = asyncio.create_task(run_hook())
        await asyncio.sleep(0.1)

        request_id = list(manager._pending_permissions.keys())[0]
        manager.resolve_permission(request_id, {"allowed": "false"})

        result = await asyncio.wait_for(task, timeout=5.0)
        assert result["decision"] == "block"
