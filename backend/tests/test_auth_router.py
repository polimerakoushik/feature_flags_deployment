from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.database import Base, get_db
from routers.auth import router as auth_router


def build_client():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    testing_session = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(engine)

    app = FastAPI()
    app.include_router(auth_router)

    def override_get_db():
        database = testing_session()
        try:
            yield database
        finally:
            database.close()

    app.dependency_overrides[get_db] = override_get_db
    return TestClient(app), engine


def register_payload(**overrides):
    payload = {
        "name": "Ada Lovelace",
        "email": "ada@example.com",
        "password": "Secure@123",
        "phone": "555-0100",
        "age": "30",
        "gender": "female",
        "role": "Admin",
        "company": "FeatureFlow",
    }
    payload.update(overrides)
    return payload


def test_registration_rejects_weak_password():
    client, engine = build_client()

    response = client.post("/auth/register", json=register_payload(password="weak"))

    assert response.status_code == 422
    detail = str(response.json()["detail"])
    assert "Password must be at least 8 characters long." in detail
    assert "Password must contain at least one uppercase letter." in detail
    assert "Password must contain at least one number." in detail

    Base.metadata.drop_all(engine)


def test_registration_login_and_profile_restore():
    client, engine = build_client()

    register_response = client.post("/auth/register", json=register_payload())
    assert register_response.status_code == 201, register_response.text
    assert "password" not in register_response.json()
    assert "password_hash" not in register_response.json()

    duplicate_response = client.post("/auth/register", json=register_payload(email="ADA@example.com"))
    assert duplicate_response.status_code == 409
    assert duplicate_response.json()["detail"] == "An account with this email already exists. Please log in or use a different email."

    missing_account = client.post("/auth/login", json={"email": "missing@example.com", "password": "Secure@123"})
    assert missing_account.status_code == 404
    assert missing_account.json()["detail"] == "Account not found. Please create a new account."

    failed_login = client.post("/auth/login", json={"email": "ada@example.com", "password": "wrong"})
    assert failed_login.status_code == 401
    assert failed_login.json()["detail"] == "Invalid email or password."

    login_response = client.post("/auth/login", json={"email": "ada@example.com", "password": "Secure@123"})
    assert login_response.status_code == 200, login_response.text
    body = login_response.json()
    assert body["access_token"]
    assert "password" not in body["user"]
    assert "password_hash" not in body["user"]

    protected_without_token = client.get("/auth/me")
    assert protected_without_token.status_code == 401

    headers = {"Authorization": f"Bearer {body['access_token']}"}
    profile_update = client.put(
        "/auth/me",
        json={
            "name": "Ada Byron",
            "phone": "555-0101",
            "age": "31",
            "gender": "female",
            "role": "Developer",
            "company": "Analytical Engines",
        },
        headers=headers,
    )
    assert profile_update.status_code == 200, profile_update.text

    restored_profile = client.get("/auth/me", headers=headers)
    assert restored_profile.status_code == 200
    assert restored_profile.json()["name"] == "Ada Byron"
    assert restored_profile.json()["company"] == "Analytical Engines"

    Base.metadata.drop_all(engine)
