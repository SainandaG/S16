import io
import shutil

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine, inspect, text  # noqa: E402

from app import migrate, seed  # noqa: E402
from app.config import settings  # noqa: E402
from app.db import Base, engine  # noqa: E402
from app.main import app  # noqa: E402

PNG_1PX = bytes.fromhex(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d3a1d30000000049454e44ae426082"
)


@pytest.fixture(scope="module")
def client():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    seed.run()
    with TestClient(app) as c:
        yield c
    engine.dispose()
    shutil.rmtree(settings.media_dir, ignore_errors=True)


@pytest.fixture(scope="module")
def auth(client):
    r = client.post("/api/admin/login", json={"email": "admin@test.local", "password": "test-password"})
    assert r.status_code == 200
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def _post(slug, status="published", **extra):
    body = {"slug": slug, "title": f"Post {slug}", "excerpt": "e", "body": "# Hi", "tags": ["vastu"], "status": status}
    body.update(extra)
    return body


# ---------- SEO ----------
def test_page_returns_seo_fields(client, auth):
    page = client.get("/api/pages/about").json()
    assert "seo_title" in page and "seo_keywords" in page and "noindex" in page
    r = client.put(
        f"/api/admin/pages/{page['id']}",
        json={**{k: page[k] for k in ("slug", "title", "meta_description", "data", "published")},
              "seo_title": "About – Custom", "seo_keywords": "a, b", "noindex": False, "canonical_url": ""},
        headers=auth,
    )
    assert r.status_code == 200
    assert client.get("/api/pages/about").json()["seo_title"] == "About – Custom"


def test_seo_settings_are_public(client):
    seo = client.get("/api/site").json()["seo"]
    assert seo["siteName"] == "S16 Design Studio"
    assert "defaultDescription" in seo


def test_duplicate_slug_returns_409(client, auth):
    r = client.post("/api/admin/pages", json={"slug": "about", "title": "Dup"}, headers=auth)
    assert r.status_code == 409


# ---------- blog ----------
def test_blog_drafts_are_hidden_until_published(client, auth):
    r = client.post("/api/admin/blog", json=_post("hidden-draft", status="draft"), headers=auth)
    assert r.status_code == 201
    assert r.json()["published_at"] is None
    assert client.get("/api/blog/hidden-draft").status_code == 404
    slugs = [p["slug"] for p in client.get("/api/blog").json()]
    assert "hidden-draft" not in slugs
    # admin list still shows it
    admin_slugs = [p["slug"] for p in client.get("/api/admin/blog", headers=auth).json()]
    assert "hidden-draft" in admin_slugs


def test_publish_stamps_date_and_appears(client, auth):
    created = client.post("/api/admin/blog", json=_post("first-post"), headers=auth).json()
    assert created["published_at"] is not None
    detail = client.get("/api/blog/first-post").json()
    assert detail["body"] == "# Hi"
    assert any(p["slug"] == "first-post" for p in client.get("/api/blog").json())


def test_blog_tag_filter_and_update(client, auth):
    post = client.post("/api/admin/blog", json=_post("tagged", tags=["interiors"]), headers=auth).json()
    tagged = client.get("/api/blog", params={"tag": "interiors"}).json()
    assert [p["slug"] for p in tagged] == ["tagged"]
    back = client.put(f"/api/admin/blog/{post['id']}", json=_post("tagged", status="draft"), headers=auth)
    assert back.status_code == 200 and back.json()["published_at"] is None


def test_blog_duplicate_slug_and_bad_slug(client, auth):
    assert client.post("/api/admin/blog", json=_post("first-post"), headers=auth).status_code == 409
    assert client.post("/api/admin/blog", json=_post("Bad Slug!"), headers=auth).status_code == 422


def test_blog_delete(client, auth):
    post = client.post("/api/admin/blog", json=_post("to-delete"), headers=auth).json()
    assert client.delete(f"/api/admin/blog/{post['id']}", headers=auth).status_code == 204
    assert client.get("/api/blog/to-delete").status_code == 404


# ---------- media ----------
def test_upload_png_and_serve(client, auth):
    r = client.post(
        "/api/admin/media",
        files={"file": ("my photo.png", io.BytesIO(PNG_1PX), "image/png")},
        headers=auth,
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["url"].startswith("https://api.example.test/media/") and body["url"].endswith(".png")
    served = client.get(body["url"].replace("https://api.example.test", ""))
    assert served.status_code == 200 and served.content == PNG_1PX
    listed = client.get("/api/admin/media", headers=auth).json()
    assert any(m["id"] == body["id"] for m in listed)
    assert client.delete(f"/api/admin/media/{body['id']}", headers=auth).status_code == 204
    assert client.get(body["url"].replace("https://api.example.test", "")).status_code == 404


def test_upload_rejects_fake_image_and_wrong_type(client, auth):
    fake = client.post(
        "/api/admin/media",
        files={"file": ("x.png", io.BytesIO(b"<html>not an image</html>"), "image/png")},
        headers=auth,
    )
    assert fake.status_code == 415
    pdf = client.post(
        "/api/admin/media",
        files={"file": ("doc.pdf", io.BytesIO(b"%PDF-1.4"), "application/pdf")},
        headers=auth,
    )
    assert pdf.status_code == 415


def test_upload_requires_auth(client):
    r = client.post("/api/admin/media", files={"file": ("a.png", io.BytesIO(PNG_1PX), "image/png")})
    assert r.status_code == 401


# ---------- sitemap & robots ----------
def test_sitemap_lists_pages_and_published_posts_only(client, auth):
    client.post("/api/admin/blog", json=_post("sitemap-draft", status="draft"), headers=auth)
    xml = client.get("/api/sitemap.xml").text
    assert "<urlset" in xml
    assert "https://example.test/projects" in xml  # portfolio page -> /projects
    assert "https://example.test/blog/first-post" in xml
    assert "sitemap-draft" not in xml


def test_robots_points_to_sitemap(client):
    txt = client.get("/api/robots.txt").text
    assert "Disallow: /admin" in txt
    assert "Sitemap: https://example.test/sitemap.xml" in txt


def test_noindex_page_left_out_of_sitemap(client, auth):
    page = client.get("/api/pages/contact").json()
    client.put(
        f"/api/admin/pages/{page['id']}",
        json={**{k: page[k] for k in ("slug", "title", "meta_description", "data", "published")}, "noindex": True},
        headers=auth,
    )
    assert "https://example.test/contact" not in client.get("/api/sitemap.xml").text


# ---------- migration of an old database ----------
def test_migration_adds_missing_page_columns(tmp_path):
    old = create_engine(f"sqlite:///{tmp_path / 'old.db'}")
    with old.begin() as conn:
        conn.execute(text("CREATE TABLE pages (id INTEGER PRIMARY KEY, slug VARCHAR(120), title VARCHAR(200), "
                          "meta_description TEXT, data JSON, published BOOLEAN)"))
        conn.execute(text("INSERT INTO pages (id, slug, title, meta_description, data, published) "
                          "VALUES (1, 'x', 'X', '', '{}', 1)"))
    added = migrate.run(old)
    assert "pages.seo_title" in added and "pages.noindex" in added
    cols = {c["name"] for c in inspect(old).get_columns("pages")}
    assert {"seo_title", "seo_keywords", "og_image", "canonical_url", "noindex"} <= cols
    with old.connect() as conn:
        row = conn.execute(text("SELECT seo_title, noindex FROM pages WHERE id = 1")).one()
    assert row[0] == "" and not row[1]
    assert migrate.run(old) == []  # idempotent
    old.dispose()
