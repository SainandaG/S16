import io
import uuid

import pytest
from fastapi.testclient import TestClient

from app import seed, storage
from app.db import Base, engine
from app.main import app

PNG = bytes.fromhex(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d3a1d30000000049454e44ae426082"
)


class FakeCloud:
    """Stands in for the Cloudinary service and records what the app asks it to do."""

    def __init__(self):
        self.uploads = []
        self.destroyed = []
        self.uploader = self

    def upload(self, file, **options):
        self.uploads.append(options)
        folder = options["folder"]
        pid = uuid.uuid4().hex
        return {"public_id": f"{folder}/{pid}", "secure_url": f"https://res.cloudinary.com/demo/image/upload/v1/{folder}/{pid}.png"}

    def destroy(self, public_id, **options):
        self.destroyed.append(public_id)


@pytest.fixture
def cloud(monkeypatch):
    fake = FakeCloud()
    monkeypatch.setattr(storage, "cloud_enabled", lambda: True)
    monkeypatch.setattr(storage, "_cloudinary", lambda: fake)
    return fake


@pytest.fixture(scope="module")
def client():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    seed.run()
    with TestClient(app) as c:
        yield c
    engine.dispose()


def _admin(client):
    r = client.post("/api/auth/login", json={"email": "admin@test.local", "password": "test-password"})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_upload_goes_to_the_section_folder_in_cloudinary(client, cloud):
    h = _admin(client)
    r = client.post(
        "/api/admin/media",
        files={"file": ("sofa.png", io.BytesIO(PNG), "image/png")},
        data={"folder": "services"},
        headers=h,
    )
    assert r.status_code == 201, r.text
    assert cloud.uploads[0]["folder"] == "s16/services"
    body = r.json()
    assert body["folder"] == "services" and body["storage"] == "cloudinary"
    assert "/upload/f_auto,q_auto,w_1600,c_limit/" in body["url"]


def test_unknown_section_is_refused(client, cloud):
    r = client.post(
        "/api/admin/media",
        files={"file": ("x.png", io.BytesIO(PNG), "image/png")},
        data={"folder": "not-a-section"},
        headers=_admin(client),
    )
    assert r.status_code == 422


def test_media_can_be_listed_by_section_and_counted(client, cloud):
    h = _admin(client)
    client.post("/api/admin/media", files={"file": ("a.png", io.BytesIO(PNG), "image/png")}, data={"folder": "about"}, headers=h)
    listed = client.get("/api/admin/media", params={"folder": "about"}, headers=h).json()
    assert listed and all(m["folder"] == "about" for m in listed)
    counts = {f["key"]: f["count"] for f in client.get("/api/admin/media/folders", headers=h).json()}
    assert counts["about"] >= 1


def test_delete_removes_the_image_from_cloudinary(client, cloud):
    h = _admin(client)
    created = client.post(
        "/api/admin/media", files={"file": ("b.png", io.BytesIO(PNG), "image/png")}, data={"folder": "journal"}, headers=h
    ).json()
    assert client.delete(f"/api/admin/media/{created['id']}", headers=h).status_code == 204
    assert len(cloud.destroyed) == 1 and cloud.destroyed[0].startswith("s16/journal/")
