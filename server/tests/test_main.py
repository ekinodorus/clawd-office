"""Tests for server/src/main.py — FastAPI HTTP endpoints."""

import pytest
from httpx import AsyncClient, ASGITransport

from src.main import app


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


class TestHealthEndpoint:
    @pytest.mark.asyncio
    async def test_health_returns_ok(self, client):
        resp = await client.get("/api/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"


class TestOpenDirectory:
    @pytest.mark.asyncio
    async def test_open_directory_invalid_path_returns_400(self, client):
        resp = await client.post(
            "/api/open-directory",
            json={"path": "/nonexistent/path/that/does/not/exist"},
        )
        assert resp.status_code == 400
