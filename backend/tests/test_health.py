from fastapi import status
from fastapi.testclient import TestClient

from app.main import create_app


def test_healthz() -> None:
    client = TestClient(create_app())
    response = client.get("/healthz")
    assert response.status_code == status.HTTP_200_OK
    assert response.json()["status"] == "ok"
