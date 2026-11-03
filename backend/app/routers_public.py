from datetime import datetime, timezone
from xml.sax.saxutils import escape

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import PlainTextResponse, Response
from sqlalchemy.orm import Session

from . import models, schemas
from .config import settings
from .db import get_db

router = APIRouter(prefix="/api", tags=["public"])

# Frontend route for each page slug (used by the sitemap).
PAGE_PATHS = {
    "home": "/",
    "about": "/about",
    "services": "/services",
    "portfolio": "/projects",
    "process": "/process",
    "contact": "/contact",
}


@router.get("/site")
def get_site(db: Session = Depends(get_db)):
    """All global settings as one object: {site, contact, brand, navigation, footer, seo}."""
    return {row.key: row.value for row in db.query(models.SiteSetting).all()}


@router.get("/pages/{slug}", response_model=schemas.PageOut)
def get_page(slug: str, db: Session = Depends(get_db)):
    page = db.query(models.Page).filter_by(slug=slug, published=True).first()
    if page is None:
        raise HTTPException(status_code=404, detail="Page not found")
    return page


@router.get("/projects", response_model=list[schemas.ProjectOut])
def list_projects(category: str | None = None, db: Session = Depends(get_db)):
    query = db.query(models.Project).filter(models.Project.published.is_(True))
    if category and category != "All":
        query = query.filter(models.Project.category == category)
    return query.order_by(models.Project.sort_order, models.Project.id).all()


@router.get("/services", response_model=list[schemas.ServiceOut])
def list_services(db: Session = Depends(get_db)):
    return (
        db.query(models.Service)
        .filter(models.Service.published.is_(True))
        .order_by(models.Service.sort_order, models.Service.id)
        .all()
    )


# ---------- blog (published posts only) ----------
@router.get("/blog", response_model=list[schemas.BlogOut])
def list_blog(tag: str | None = None, limit: int = 50, db: Session = Depends(get_db)):
    posts = (
        db.query(models.BlogPost)
        .filter(models.BlogPost.status == "published")
        .order_by(models.BlogPost.published_at.desc(), models.BlogPost.id.desc())
        .limit(min(max(limit, 1), 100))
        .all()
    )
    if tag:
        posts = [p for p in posts if tag in (p.tags or [])]
    return posts


@router.get("/blog/{slug}", response_model=schemas.BlogOut)
def get_blog_post(slug: str, db: Session = Depends(get_db)):
    post = db.query(models.BlogPost).filter_by(slug=slug, status="published").first()
    if post is None:
        raise HTTPException(status_code=404, detail="Post not found")
    return post


# ---------- SEO endpoints ----------
def _base() -> str:
    return settings.public_site_url.rstrip("/")


def _lastmod(dt: datetime | None) -> str:
    if dt is None:
        return ""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return f"<lastmod>{dt.astimezone(timezone.utc).date().isoformat()}</lastmod>"


@router.get("/sitemap.xml", response_class=Response)
def sitemap(db: Session = Depends(get_db)):
    """Sitemap of every public page and published post. Pages marked noindex are left out."""
    urls: list[str] = []
    for page in db.query(models.Page).filter_by(published=True, noindex=False).all():
        path = PAGE_PATHS.get(page.slug, f"/{page.slug}")
        loc = page.canonical_url or f"{_base()}{path}"
        urls.append(f"<url><loc>{escape(loc)}</loc>{_lastmod(page.updated_at)}</url>")
    for post in db.query(models.BlogPost).filter_by(status="published", noindex=False).all():
        urls.append(
            f"<url><loc>{escape(f'{_base()}/blog/{post.slug}')}</loc>{_lastmod(post.updated_at)}</url>"
        )
    body = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "\n".join(urls)
        + "\n</urlset>\n"
    )
    return Response(content=body, media_type="application/xml")


@router.get("/robots.txt", response_class=PlainTextResponse)
def robots():
    return PlainTextResponse(
        "User-agent: *\nAllow: /\nDisallow: /admin\n\n" f"Sitemap: {_base()}/sitemap.xml\n"
    )


@router.get("/resolve")
def resolve_redirect(path: str, db: Session = Depends(get_db)):
    """Used by the frontend router: returns a redirect target for the given path, if any."""
    rule = db.query(models.Redirect).filter_by(source_path=path, enabled=True).first()
    if rule is None:
        return {"redirect": None}
    return {"redirect": {"target": rule.target_url, "status": rule.status_code}}


@router.post("/contact", status_code=201)
def submit_contact(payload: schemas.LeadIn, db: Session = Depends(get_db)):
    if payload.website:  # honeypot filled in: pretend success, store nothing
        return {"ok": True}
    data = payload.model_dump(exclude={"website"})
    db.add(models.Lead(**data))
    db.commit()
    return {"ok": True, "message": "Our team will reach out to you within 24 hours."}
