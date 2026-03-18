"""Tests for server/src/models.py"""

from src.models import AgentInfo, ConversationEntry, SubAgentInfo


class TestConversationEntry:
    def test_to_dict_basic(self):
        entry = ConversationEntry(
            timestamp=1000.0,
            role="user",
            content="hello",
        )
        d = entry.to_dict()
        assert d == {"timestamp": 1000.0, "role": "user", "content": "hello"}

    def test_to_dict_with_tool_name(self):
        entry = ConversationEntry(
            timestamp=2000.0,
            role="tool",
            content="Using Edit",
            tool_name="Edit",
        )
        d = entry.to_dict()
        assert d["toolName"] == "Edit"

    def test_to_dict_without_tool_name_omits_key(self):
        entry = ConversationEntry(timestamp=1000.0, role="assistant", content="hi")
        d = entry.to_dict()
        assert "toolName" not in d


class TestAgentInfo:
    def test_to_client_dict_minimal(self):
        agent = AgentInfo(id="a-1", name="Test")
        d = agent.to_client_dict()
        assert d["id"] == "a-1"
        assert d["name"] == "Test"
        assert d["state"] == "idle"
        assert d["currentAction"] == ""
        assert d["conversationLog"] == []
        assert d["color"] is None

    def test_to_client_dict_with_optional_fields(self):
        agent = AgentInfo(
            id="a-2",
            name="Worker",
            work_directory="/tmp/proj",
            git_branch="main",
            color="#5b6ee1",
            error="something broke",
        )
        d = agent.to_client_dict()
        assert d["workDirectory"] == "/tmp/proj"
        assert d["gitBranch"] == "main"
        assert d["color"] == "#5b6ee1"
        assert d["error"] == "something broke"

    def test_to_client_dict_omits_none_optional_fields(self):
        agent = AgentInfo(id="a-3", name="Clean")
        d = agent.to_client_dict()
        assert "workDirectory" not in d
        assert "gitBranch" not in d
        assert "error" not in d

    def test_to_client_dict_includes_sub_agents(self):
        sub = SubAgentInfo(id="sub-1", name="researcher", description="Research task", parent_id="a-4")
        agent = AgentInfo(id="a-4", name="Lead", sub_agents=[sub])
        d = agent.to_client_dict()
        assert d["subAgents"] == [
            {"id": "sub-1", "name": "researcher", "description": "Research task", "parentId": "a-4"}
        ]

    def test_to_client_dict_empty_sub_agents(self):
        agent = AgentInfo(id="a-5", name="Solo")
        d = agent.to_client_dict()
        assert d["subAgents"] == []


    def test_permission_mode_default(self):
        agent = AgentInfo(id="a-6", name="Default")
        assert agent.permission_mode == "default"

    def test_permission_mode_custom(self):
        agent = AgentInfo(id="a-7", name="Custom", permission_mode="plan")
        assert agent.permission_mode == "plan"

    def test_to_client_dict_includes_permission_mode(self):
        agent = AgentInfo(id="a-8", name="Mode", permission_mode="plan")
        d = agent.to_client_dict()
        assert d["permissionMode"] == "plan"

    def test_to_client_dict_default_permission_mode(self):
        agent = AgentInfo(id="a-9", name="DefMode")
        d = agent.to_client_dict()
        assert d["permissionMode"] == "default"


class TestAllowedTools:
    def test_allowed_tools_default_empty(self):
        agent = AgentInfo(id="a-10", name="NoTools")
        assert agent.allowed_tools == set()

    def test_allowed_tools_custom(self):
        agent = AgentInfo(id="a-11", name="WithTools", allowed_tools={"Bash", "Edit"})
        assert agent.allowed_tools == {"Bash", "Edit"}

    def test_to_client_dict_includes_allowed_tools(self):
        agent = AgentInfo(id="a-12", name="Tools", allowed_tools={"Bash", "Write"})
        d = agent.to_client_dict()
        assert sorted(d["allowedTools"]) == ["Bash", "Write"]

    def test_to_client_dict_empty_allowed_tools(self):
        agent = AgentInfo(id="a-13", name="Empty")
        d = agent.to_client_dict()
        assert d["allowedTools"] == []


class TestSubAgentInfo:
    def test_to_dict(self):
        sub = SubAgentInfo(id="s-1", name="helper", description="Helping", parent_id="a-1")
        d = sub.to_dict()
        assert d == {"id": "s-1", "name": "helper", "description": "Helping", "parentId": "a-1"}
