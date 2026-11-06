import pytest
from unittest.mock import AsyncMock
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import get_db

client = TestClient(app)


def test_api_health_endpoint_connected():
    mock_session = AsyncMock()
    mock_session.execute.return_value = None

    async def override_get_db():
        yield mock_session

    app.dependency_overrides[get_db] = override_get_db
    try:
        response = client.get("/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert data["database"] == "connected"
    finally:
        app.dependency_overrides.clear()


def test_api_health_endpoint_disconnected():
    mock_session = AsyncMock()
    mock_session.execute.side_effect = Exception("Connection error")

    async def override_get_db():
        yield mock_session

    app.dependency_overrides[get_db] = override_get_db
    try:
        response = client.get("/api/health")
        assert response.status_code in (500, 503)
        data = response.json()
        assert data["status"] == "error"
        assert data["database"] == "disconnected"
        assert data["detail"] == "Database connection failed"
    finally:
        app.dependency_overrides.clear()


def test_root_endpoint():
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "docs" in data
    assert data["health"] == "/api/health"
