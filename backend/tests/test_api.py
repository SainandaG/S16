import os

# Use an isolated SQLite file for tests (must be set before the app is imported)
os.environ["DATABASE_URL"] = "sqlite:///./test_tmp.db"
os.environ["ADMIN_EMAIL"] = "admin@test.local"
os.environ["ADMIN_PASSWORD"] = "test-password"
os.environ["JWT_SECRET"] = "test-secret"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.db import Base, engine  # noqa: E402
from app.main import app  # noqa: E402
from app import seed  # noqa: E402


@pytest.fixture(scope="module")
def client():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    seed.run()
    with TestClient(app) as c:
        yield c
    engine.dispose()
    if os.path.exists("test_tmp.db"):
        os.remove("test_tmp.db")


def _token(client):
    r = client.post("/api/admin/login", json={"email": "admin@test.local", "password": "test-password"})
    assert r.status_code == 200
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_health(client):
    assert client.get("/api/health").json() == {"status": "ok"}


def test_public_site_and_pages(client):
    site = client.get("/api/site").json()
    assert site["contact"]["whatsapp"]["number"] == "+91 81232 44152"
    assert client.get("/api/pages/home").status_code == 200
    assert client.get("/api/pages/does-not-exist").status_code == 404


def test_projects_filter_and_services(client):
    all_projects = client.get("/api/projects").json()
    assert len(all_projects) == 6
    villas = client.get("/api/projects", params={"category": "Villas"}).json()
    assert villas and all(p["category"] == "Villas" for p in villas)
    assert len(client.get("/api/services").json()) == 7


def test_contact_lead_and_honeypot(client):
    body = {"name": "Test User", "email": "user@example.com", "project_type": "Retail Space"}
    assert client.post("/api/contact", json=body).status_code == 201
    spam = dict(body, website="http://spam.example")
    assert client.post("/api/contact", json=spam).status_code == 201
    headers = _token(client)
    leads = client.get("/api/admin/leads", headers=headers).json()
    assert len(leads) == 1  # honeypot submission was not stored


def test_admin_requires_auth(client):
    assert client.get("/api/admin/pages").status_code == 401
    assert client.get("/api/admin/pages", headers={"Authorization": "Bearer nope"}).status_code == 401


def test_admin_crud_page_and_redirect(client):
    h = _token(client)
    payload = {"slug": "test-page", "title": "Test", "data": {"x": 1}, "published": False}
    created = client.post("/api/admin/pages", json=payload, headers=h)
    assert created.status_code == 201
    page_id = created.json()["id"]
    # unpublished pages are hidden from the public API
    assert client.get("/api/pages/test-page").status_code == 404

    updated = client.put(f"/api/admin/pages/{page_id}", json=dict(payload, published=True), headers=h)
    assert updated.json()["published"] is True
    assert client.get("/api/pages/test-page").status_code == 200

    rule = {"source_path": "/old", "target_url": "/portfolio", "status_code": 301, "enabled": True}
    rid = client.post("/api/admin/redirects", json=rule, headers=h).json()["id"]
    assert client.get("/api/resolve", params={"path": "/old"}).json()["redirect"]["target"] == "/portfolio"
    assert client.delete(f"/api/admin/redirects/{rid}", headers=h).status_code == 204
    assert client.get("/api/resolve", params={"path": "/old"}).json()["redirect"] is None


def test_settings_upsert(client):
    h = _token(client)
    r = client.put("/api/admin/settings/footer", json={"value": {"legal": ["Privacy"]}}, headers=h)
    assert r.status_code == 200
    assert client.get("/api/site").json()["footer"] == {"legal": ["Privacy"]}


def test_admin_can_add_and_hide_a_service(client):
    h = _token(client)
    body = {"title": "Landscape Design", "description": "Gardens and outdoor living.",
            "items": ["Garden planning", "Pool & deck design"], "image_url": "", "sort_order": 9, "published": True}
    created = client.post("/api/admin/services", json=body, headers=h)
    assert created.status_code == 201
    sid = created.json()["id"]
    public = [s["title"] for s in client.get("/api/services").json()]
    assert "Landscape Design" in public
    item = next(s for s in client.get("/api/services").json() if s["id"] == sid)
    assert item["items"] == ["Garden planning", "Pool & deck design"]
    client.put(f"/api/admin/services/{sid}", json=dict(body, published=False), headers=h)
    assert "Landscape Design" not in [s["title"] for s in client.get("/api/services").json()]
