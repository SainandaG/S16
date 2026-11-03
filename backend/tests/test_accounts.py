import pytest
from fastapi.testclient import TestClient

from app import seed
from app.db import Base, engine
from app.main import app


@pytest.fixture(scope="module")
def client():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    seed.run()
    with TestClient(app) as c:
        yield c
    engine.dispose()


def _admin(client):
    r = client.post("/api/admin/login", json={"email": "admin@test.local", "password": "test-password"})
    assert r.status_code == 200
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def _register(client, email="ravi@example.com", password="secret123"):
    return client.post("/api/auth/register", json={"name": "Ravi Kumar", "email": email, "phone": "9999900000", "password": password})


def test_customer_register_and_me(client):
    r = _register(client)
    assert r.status_code == 201
    token = r.json()["access_token"]
    assert r.json()["customer"]["email"] == "ravi@example.com"
    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200 and me.json()["name"] == "Ravi Kumar"


def test_duplicate_email_and_short_password_rejected(client):
    assert _register(client).status_code == 409
    short = client.post("/api/auth/register", json={"name": "A B", "email": "x@example.com", "password": "123"})
    assert short.status_code == 422


def test_login_correct_and_wrong_password(client):
    ok = client.post("/api/auth/login", json={"email": "ravi@example.com", "password": "secret123"})
    assert ok.status_code == 200
    bad = client.post("/api/auth/login", json={"email": "ravi@example.com", "password": "wrong-password"})
    assert bad.status_code == 401
    unknown = client.post("/api/auth/login", json={"email": "nobody@example.com", "password": "whatever1"})
    assert unknown.status_code == 401 and unknown.json()["detail"] == bad.json()["detail"]


def test_customer_token_cannot_open_admin(client):
    token = client.post("/api/auth/login", json={"email": "ravi@example.com", "password": "secret123"}).json()["access_token"]
    r = client.get("/api/admin/leads", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 403


def test_admin_token_cannot_open_customer_area(client):
    admin = _admin(client)
    r = client.get("/api/auth/me", headers=admin)
    assert r.status_code == 403


def test_customer_sees_own_enquiries_only(client):
    client.post("/api/contact", json={"name": "Ravi Kumar", "email": "ravi@example.com", "message": "Need a villa"})
    client.post("/api/contact", json={"name": "Someone Else", "email": "other@example.com", "message": "Other"})
    token = client.post("/api/auth/login", json={"email": "ravi@example.com", "password": "secret123"}).json()["access_token"]
    mine = client.get("/api/auth/enquiries", headers={"Authorization": f"Bearer {token}"}).json()
    assert mine and all(e["email"] == "ravi@example.com" for e in mine)


def test_profile_update(client):
    token = client.post("/api/auth/login", json={"email": "ravi@example.com", "password": "secret123"}).json()["access_token"]
    r = client.put("/api/auth/me", json={"name": "Ravi K.", "phone": "8888800000"}, headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200 and r.json()["name"] == "Ravi K."


def test_admin_can_add_admin_and_change_password(client):
    admin = _admin(client)
    r = client.post("/api/admin/users", json={"email": "second@test.local", "password": "another-pass"}, headers=admin)
    assert r.status_code == 201
    second_id = r.json()["id"]
    assert client.post("/api/admin/login", json={"email": "second@test.local", "password": "another-pass"}).status_code == 200
    wrong = client.put("/api/admin/me/password", json={"current_password": "nope-nope", "new_password": "newpassword1"}, headers=admin)
    assert wrong.status_code == 400
    ok = client.put("/api/admin/me/password", json={"current_password": "test-password", "new_password": "newpassword1"}, headers=admin)
    assert ok.status_code == 204
    assert client.post("/api/admin/login", json={"email": "admin@test.local", "password": "newpassword1"}).status_code == 200
    client.put("/api/admin/me/password", json={"current_password": "newpassword1", "new_password": "test-password"}, headers=_admin_with(client, "newpassword1"))
    assert client.delete(f"/api/admin/users/{second_id}", headers=admin).status_code == 204


def test_cannot_remove_yourself(client):
    admin = _admin(client)
    me = client.get("/api/admin/me", headers=admin).json()
    users = client.get("/api/admin/users", headers=admin).json()
    own = next(u for u in users if u["email"] == me["email"])
    assert client.delete(f"/api/admin/users/{own['id']}", headers=admin).status_code == 400


def _admin_with(client, password):
    return {"Authorization": "Bearer " + client.post("/api/admin/login", json={"email": "admin@test.local", "password": password}).json()["access_token"]}


def test_one_sign_in_returns_admin_role_for_admin_credentials(client):
    r = client.post("/api/auth/login", json={"email": "admin@test.local", "password": "test-password"})
    assert r.status_code == 200 and r.json()["role"] == "admin"
    token = r.json()["access_token"]
    assert client.get("/api/admin/leads", headers={"Authorization": f"Bearer {token}"}).status_code == 200


def test_one_sign_in_returns_customer_role_for_customer(client):
    r = client.post("/api/auth/login", json={"email": "ravi@example.com", "password": "secret123"})
    assert r.status_code == 200 and r.json()["role"] == "customer"
