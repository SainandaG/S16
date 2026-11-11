import pytest
from fastapi.testclient import TestClient

from app import seed
from app.db import Base, engine
from app.main import app

PNG = b"\x89PNG\r\n\x1a\n" + b"0" * 32


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


def _customer(client, name, email):
    r = client.post("/api/auth/register", json={"name": name, "email": email, "password": "secret123"})
    assert r.status_code == 201
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_customer_request_timeline_and_privacy(client):
    ravi = _customer(client, "Ravi Kumar", "ravi@example.com")
    meena = _customer(client, "Meena Rao", "meena@example.com")
    admin = _admin(client)

    created = client.post(
        "/api/workspace/projects",
        headers=ravi,
        data={"title": "Family villa", "brief": "Warm wood, open kitchen"},
        files={"files": ("ref.png", PNG, "image/png")},
    )
    assert created.status_code == 201
    project_id = created.json()["id"]
    assert created.json()["status"] == "requested"

    mine = client.get("/api/workspace/projects", headers=ravi).json()
    assert [p["id"] for p in mine] == [project_id]

    # another customer cannot see it
    assert client.get(f"/api/workspace/projects/{project_id}", headers=meena).status_code == 404
    assert client.get("/api/workspace/projects", headers=meena).json() == []

    # admin sees every project with the customer's details, and posts progress
    assert any(p["customer_email"] == "ravi@example.com" for p in client.get("/api/admin/workspace/projects", headers=admin).json())
    posted = client.post(
        f"/api/admin/workspace/projects/{project_id}/updates",
        headers=admin,
        data={"note": "Concept drawings are ready for review", "status": "concept"},
        files={"files": ("concept.png", PNG, "image/png")},
    )
    assert posted.status_code == 201
    assert posted.json()["author_role"] == "admin"
    assert len(posted.json()["images"]) == 1

    detail = client.get(f"/api/workspace/projects/{project_id}", headers=ravi).json()
    assert detail["status"] == "concept"
    assert [u["author_role"] for u in detail["updates"]] == ["customer", "admin"]

    # customer replies with a note
    reply = client.post(f"/api/workspace/projects/{project_id}/updates", headers=ravi, data={"note": "Love it, please add a study"})
    assert reply.status_code == 201
    assert client.get(f"/api/workspace/projects/{project_id}", headers=ravi).json()["updates"][-1]["author_role"] == "customer"


def test_empty_updates_and_bad_files_rejected(client):
    ravi = _customer(client, "Arjun Das", "arjun@example.com")
    admin = _admin(client)
    project_id = client.post("/api/workspace/projects", headers=ravi, data={"title": "Office fit-out"}).json()["id"]

    assert client.post(f"/api/workspace/projects/{project_id}/updates", headers=ravi, data={"note": "  "}).status_code == 422
    assert client.post(f"/api/admin/workspace/projects/{project_id}/updates", headers=admin, data={}).status_code == 422
    assert client.post(
        f"/api/admin/workspace/projects/{project_id}/updates", headers=admin, data={"status": "unknown"}
    ).status_code == 422

    not_image = client.post(
        f"/api/workspace/projects/{project_id}/updates",
        headers=ravi,
        data={"note": "see attached"},
        files={"files": ("plan.pdf", b"%PDF-1.4 test", "application/pdf")},
    )
    assert not_image.status_code == 415
    fake_png = client.post(
        f"/api/workspace/projects/{project_id}/updates",
        headers=ravi,
        files={"files": ("x.png", b"not really a png", "image/png")},
    )
    assert fake_png.status_code == 415


def test_customers_cannot_use_admin_routes(client):
    ravi = _customer(client, "Sana Ali", "sana@example.com")
    assert client.get("/api/admin/workspace/projects", headers=ravi).status_code in (401, 403)


def test_enquiry_with_photo_reaches_admin(client):
    admin = _admin(client)
    r = client.post(
        "/api/contact/attachments",
        data={
            "name": "Kiran Shah",
            "email": "kiran@example.com",
            "project_type": "Villas",
            "message": "Is a villa renovation in Jubilee Hills available?",
        },
        files={"files": ("my-house.png", PNG, "image/png")},
    )
    assert r.status_code == 201
    leads = client.get("/api/admin/leads", headers=admin).json()
    match = next(l for l in leads if l["email"] == "kiran@example.com")
    assert len(match["images"]) == 1
    assert match["images"][0]["url"]


def test_enquiry_validation_and_honeypot(client):
    bad = client.post("/api/contact/attachments", data={"name": "K", "email": "not-an-email"})
    assert bad.status_code == 422
    bot = client.post(
        "/api/contact/attachments",
        data={"name": "Bot Person", "email": "bot@example.com", "website": "http://spam.example"},
    )
    assert bot.status_code == 201
    admin = _admin(client)
    assert all(l["email"] != "bot@example.com" for l in client.get("/api/admin/leads", headers=admin).json())
