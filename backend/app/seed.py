"""Load the initial S16 content into the database.

Run from the backend folder:
    python -m app.seed                   # first-time load (never overwrites existing rows)
    python -m app.seed --update-content  # also refresh page copy, SEO and site settings from seed JSON

Projects, services and admin users are only inserted when their table is empty,
so edits made in the admin are kept.
"""

import json
import sys
from pathlib import Path

from sqlalchemy.orm import Session

from . import migrate, models
from .config import settings
from .db import Base, SessionLocal, engine
from .security import hash_password

SEED_FILE = Path(__file__).resolve().parents[1] / "seed" / "site-content.json"
SETTING_KEYS = ("site", "contact", "brand", "navigation", "footer", "seo")


def _upsert_setting(db: Session, key: str, value, update: bool) -> None:
    row = db.get(models.SiteSetting, key)
    if row is None:
        db.add(models.SiteSetting(key=key, value=value))
    elif update:
        row.value = value


def _ensure_page(db: Session, slug: str, title: str, data: dict, meta: str, seo: dict, update: bool) -> None:
    page = db.query(models.Page).filter_by(slug=slug).first()
    if page is None:
        db.add(models.Page(slug=slug, title=title, meta_description=meta, data=data, published=True, **seo))
    elif update:
        page.title = title
        page.data = data
        if meta:
            page.meta_description = meta
        for key, value in seo.items():
            setattr(page, key, value)


def run(update: bool = False) -> None:
    Base.metadata.create_all(bind=engine)
    migrate.run(engine)
    content = json.loads(SEED_FILE.read_text(encoding="utf-8"))
    pages = content["pages"]
    page_seo = content.get("pageSeo", {})
    db = SessionLocal()
    try:
        for key in SETTING_KEYS:
            if key in content:
                _upsert_setting(db, key, content[key], update)

        meta = content["site"].get("metaDescription", "")
        specs = [
            ("home", "Home", pages["home"], meta),
            ("about", "About Us", pages["about"], ""),
            ("services", "Services", pages["services"], ""),
            ("portfolio", "Projects", pages["portfolio"], ""),
            ("process", "Our Process", pages["process"], ""),
            ("contact", "Contact Us", pages["contactPage"], ""),
        ]
        for slug, title, data, description in specs:
            _ensure_page(db, slug, title, data, description, page_seo.get(slug, {}), update)
        db.flush()

        # projects: seeded once; with --update-content the seed list replaces them
        if update:
            db.query(models.Project).delete()
        if db.query(models.Project).count() == 0:
            for i, p in enumerate(content.get("projects", [])):
                db.add(
                    models.Project(
                        title=p["title"],
                        category=p["category"],
                        location=p.get("location", ""),
                        image_url=p.get("image", ""),
                        description=p.get("description", ""),
                        sort_order=i,
                    )
                )

        # services: seeded once; with --update-content the seed list replaces them
        if update:
            db.query(models.Service).delete()
        if db.query(models.Service).count() == 0:
            for i, s in enumerate(content.get("pillars", [])):
                db.add(
                    models.Service(
                        title=s["title"],
                        description=s.get("description", ""),
                        items=s.get("items", []),
                        image_url=s.get("image", ""),
                        sort_order=i,
                    )
                )

        email = settings.admin_email.lower()
        if db.query(models.AdminUser).filter_by(email=email).first() is None:
            db.add(models.AdminUser(email=email, password_hash=hash_password(settings.admin_password)))

        db.commit()
        print("Seed complete." + (" Content refreshed." if update else ""))
    finally:
        db.close()


if __name__ == "__main__":
    run(update="--update-content" in sys.argv)
