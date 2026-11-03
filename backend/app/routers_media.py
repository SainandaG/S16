import re

from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile
from sqlalchemy.orm import Session

from . import models, schemas, storage
from .db import get_db
from .security import require_admin

router = APIRouter(prefix="/api/admin/media", tags=["admin-media"], dependencies=[Depends(require_admin)])

MAX_BYTES = 8 * 1024 * 1024
MAGIC = {
    "image/jpeg": (b"\xff\xd8\xff",),
    "image/png": (b"\x89PNG\r\n\x1a\n",),
    "image/gif": (b"GIF8",),
}


def _is_image(content_type: str, data: bytes) -> bool:
    if content_type == "image/webp":
        return data[:4] == b"RIFF" and data[8:12] == b"WEBP"
    return any(data.startswith(m) for m in MAGIC[content_type])


def _out(row: models.MediaFile) -> schemas.MediaOut:
    if row.url:
        url = row.url
    elif row.folder:
        url = f"/media/{row.folder}/{row.filename}"
    else:
        url = f"/media/{row.filename}"  # files uploaded before sections existed
    if row.storage == "cloudinary":
        url = storage.optimised(url)
    return schemas.MediaOut(
        id=row.id,
        filename=row.filename,
        original_name=row.original_name,
        content_type=row.content_type,
        size_bytes=row.size_bytes,
        url=url,
        folder=row.folder or "general",
        storage=row.storage or "local",
        created_at=row.created_at,
    )


@router.get("/folders")
def folders(db: Session = Depends(get_db)):
    """The sections images can belong to, with how many images each holds."""
    counts = {}
    for row in db.query(models.MediaFile.folder).all():
        counts[row[0] or "general"] = counts.get(row[0] or "general", 0) + 1
    return [{"key": k, "label": label, "count": counts.get(k, 0)} for k, label in storage.FOLDERS.items()]


@router.get("", response_model=list[schemas.MediaOut])
def list_media(folder: str | None = None, db: Session = Depends(get_db)):
    query = db.query(models.MediaFile)
    if folder:
        query = query.filter(models.MediaFile.folder == folder)
    return [_out(m) for m in query.order_by(models.MediaFile.id.desc()).all()]


@router.post("", response_model=schemas.MediaOut, status_code=201)
async def upload(
    file: UploadFile = File(...),
    folder: str = Form("general"),
    db: Session = Depends(get_db),
):
    if not storage.valid_folder(folder):
        raise HTTPException(status_code=422, detail="Unknown section for this image")
    if file.content_type not in storage.EXTENSIONS:
        raise HTTPException(status_code=415, detail="Only JPG, PNG, GIF or WebP images are allowed")
    data = await file.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="Image is larger than 8 MB")
    if not _is_image(file.content_type, data):
        raise HTTPException(status_code=415, detail="File content does not match an image type")

    saved = storage.save_image(data, folder, file.content_type)
    row = models.MediaFile(
        filename=saved["filename"],
        original_name=re.sub(r"[^\w.\- ]", "_", file.filename or saved["filename"])[:255],
        content_type=file.content_type,
        size_bytes=len(data),
        folder=folder,
        storage=saved["storage"],
        public_id=saved["public_id"],
        url=saved["url"],
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _out(row)


@router.delete("/{media_id}", status_code=204)
def delete_media(media_id: int, db: Session = Depends(get_db)):
    row = db.get(models.MediaFile, media_id)
    if row is None:
        raise HTTPException(status_code=404, detail="File not found")
    storage.delete_image(row)
    db.delete(row)
    db.commit()
    return Response(status_code=204)
