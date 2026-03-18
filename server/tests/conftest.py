"""Shared fixtures for server tests."""

from __future__ import annotations

from unittest.mock import AsyncMock

import pytest
import socketio


@pytest.fixture
def mock_sio():
    """Create a mock Socket.IO server for testing AgentManager."""
    sio = AsyncMock(spec=socketio.AsyncServer)
    sio.emit = AsyncMock()
    return sio
