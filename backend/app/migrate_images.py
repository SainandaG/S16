"""Moves existing images (seeded Unsplash links, or any non-Cloudinary URL) into Cloudinary.

Run from the backend folder with CLOUDINARY_URL and DATABASE_URL set:

    python -m app.migrate_images            # dry run: lists what would move
    python -m app.migrate_images --apply    # downloads, uploads to Cloudinary, updates the database

Each image goes to the folder for its section (projects, services, journal, seo).
Images that are already on Cloudinary are skipped, so the script is safe to run again.
"""

import sys
import urllib.request

from . import models
from .db import SessionLocal
from .storage import cloud_enabled, save_image

# model, column holding the URL, Cloudinary folder
TARGETS = [
    (models.Project, "image_url", "projects"),
    (models.Service, "image_url", "services"),
    (models.BlogPost, "cover_image", "journal"),
    (models.Page, "og_image", "seo"),
]

MAX_BYTES = 8 * 1024 * 1024


def sniff(data: bytes) -> str | None:
    """Returns the image type from the file's first bytes, or None if it is not a supported image."""
    if data[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if data[:4] == b"GIF8":
        return "image/gif"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return None


def fetch(url: str) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": "S16-image-migration/1.0"})
    with urllib.request.urlopen(request, timeout=30) as response:
        data = response.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise ValueError("larger than 8 MB")
    return data


def main() -> int:
    apply = "--apply" in sys.argv
    if not cloud_enabled():
        print("CLOUDINARY_URL is not set. Set it first, then run this again.")
        return 1

    db = SessionLocal()
    moved = skipped = 0
    try:
        for model, field, folder in TARGETS:
            for row in db.query(model).all():
                url = getattr(row, field) or ""
                if not url.startswith("http") or "res.cloudinary.com" in url:
                    continue
                label = f"{model.__name__} #{getattr(row, 'id', '?')} ({field})"
                try:
                    data = fetch(url)
                except Exception as error:  # network or size problem: report and continue
                    print(f"SKIP   {label}: could not download ({error})")
                    skipped += 1
                    continue
                content_type = sniff(data)
                if not content_type:
                    print(f"SKIP   {label}: not a supported image")
                    skipped += 1
                    continue
                if not apply:
                    print(f"WOULD MOVE {label} -> s16/{folder}")
                    moved += 1
                    continue
                saved = save_image(data, folder, content_type)
                setattr(row, field, saved["url"])
                print(f"MOVED  {label} -> {saved['url']}")
                moved += 1
        if apply:
            db.commit()
    finally:
        db.close()

    mode = "moved" if apply else "would be moved (dry run, add --apply to move them)"
    print(f"\n{moved} image(s) {mode}. {skipped} skipped.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
