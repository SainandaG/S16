"""Image storage. Uses Cloudinary when CLOUDINARY_URL is set, otherwise the local media folder.

Every upload belongs to a section of the site (services, about, projects, ...). In Cloudinary the
section becomes a folder, e.g. s16/services, so the media library is organised the same way the site is.
"""

import io
import uuid
from pathlib import Path
from urllib.parse import urlparse

from .config import settings

# section key -> label shown in the admin. The key is also the Cloudinary folder name.
FOLDERS = {
    "home": "Home page",
    "about": "About",
    "services": "Services",
    "projects": "Projects",
    "journal": "Journal",
    "pages": "Pages",
    "contact": "Contact",
    "seo": "SEO and sharing",
    "general": "General",
}

EXTENSIONS = {"image/jpeg": ".jpg", "image/png": ".png", "image/gif": ".gif", "image/webp": ".webp"}


def valid_folder(folder: str) -> bool:
    return folder in FOLDERS


def cloud_enabled() -> bool:
    return bool(settings.cloudinary_url)


def _cloudinary():
    import cloudinary  # imported lazily so local development does not need the package configured
    import cloudinary.uploader  # the upload and delete functions live in this submodule

    # cloudinary://API_KEY:API_SECRET@CLOUD_NAME -> the three values the SDK needs
    parts = urlparse(settings.cloudinary_url)
    cloudinary.config(cloud_name=parts.hostname, api_key=parts.username, api_secret=parts.password, secure=True)
    return cloudinary


def save_image(data: bytes, folder: str, content_type: str) -> dict:
    """Stores the image and returns {filename, url, public_id, storage}."""
    if cloud_enabled():
        cloud = _cloudinary()
        result = cloud.uploader.upload(
            io.BytesIO(data),
            folder=f"s16/{folder}",
            resource_type="image",
            unique_filename=True,
            use_filename=False,
            tags=["s16", folder],
        )
        public_id = result["public_id"]
        return {
            "filename": public_id.split("/")[-1],
            "url": result["secure_url"],
            "public_id": public_id,
            "storage": "cloudinary",
        }

    name = f"{uuid.uuid4().hex}{EXTENSIONS[content_type]}"
    folder_path = Path(settings.media_dir) / folder
    folder_path.mkdir(parents=True, exist_ok=True)
    (folder_path / name).write_bytes(data)
    return {
        "filename": name,
        "url": f"{settings.public_api_url.rstrip('/')}/media/{folder}/{name}",
        "public_id": "",
        "storage": "local",
    }


def delete_image(row) -> None:
    """Removes the image from Cloudinary, or from the local folder."""
    if row.storage == "cloudinary" and row.public_id:
        if cloud_enabled():
            _cloudinary().uploader.destroy(row.public_id, resource_type="image", invalidate=True)
        return
    path = Path(settings.media_dir) / (row.folder or "general") / row.filename
    path.unlink(missing_ok=True)


def optimised(url: str) -> str:
    """Cloudinary delivery settings: automatic format and quality, at most 1600px wide."""
    if "/upload/" in url and "f_auto" not in url:
        return url.replace("/upload/", "/upload/f_auto,q_auto,w_1600,c_limit/", 1)
    return url
