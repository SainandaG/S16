import re
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Request, Response, UploadFile
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from . import models, schemas
from .config import settings
from .db import get_db
from .security import create_token, hash_password, require_admin, verify_password

auth_router = APIRouter(prefix="/api/admin", tags=["admin-auth"])
router = APIRouter(prefix="/api/admin", tags=["admin"], dependencies=[Depends(require_admin)])


@auth_router.post("/login", response_model=schemas.TokenOut)
def login(payload: schemas.LoginIn, db: Session = Depends(get_db)):
    user = db.query(models.AdminUser).filter_by(email=payload.email.lower()).first()
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    return schemas.TokenOut(access_token=create_token(user.email))


@router.get("/me")
def me(user: models.AdminUser = Depends(require_admin)):
    return {"email": user.email}


@router.put("/me/password", status_code=204)
def change_my_password(payload: schemas.PasswordChangeIn, user: models.AdminUser = Depends(require_admin), db: Session = Depends(get_db)):
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="The current password is incorrect.")
    user.password_hash = hash_password(payload.new_password)
    db.commit()
    return Response(status_code=204)


@router.get("/users", response_model=list[schemas.AdminUserOut])
def list_admins(db: Session = Depends(get_db)):
    return db.query(models.AdminUser).order_by(models.AdminUser.email).all()


@router.post("/users", response_model=schemas.AdminUserOut, status_code=201)
def add_admin(payload: schemas.AdminUserIn, db: Session = Depends(get_db)):
    email = payload.email.strip().lower()
    if db.query(models.AdminUser).filter_by(email=email).first():
        raise HTTPException(status_code=409, detail="An admin with this email already exists")
    user = models.AdminUser(email=email, password_hash=hash_password(payload.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.delete("/users/{user_id}", status_code=204)
def remove_admin(user_id: int, me: models.AdminUser = Depends(require_admin), db: Session = Depends(get_db)):
    if me.id == user_id:
        raise HTTPException(status_code=400, detail="You cannot remove your own account")
    if db.query(models.AdminUser).count() <= 1:
        raise HTTPException(status_code=400, detail="At least one admin account must remain")
    user = db.get(models.AdminUser, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="Admin not found")
    db.delete(user)
    db.commit()
    return Response(status_code=204)


def _save(db: Session, obj) -> None:
    """Commits, turning duplicate-key errors (e.g. a slug already in use) into HTTP 409."""
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="A record with this value already exists")
    db.refresh(obj)


def _crud(path: str, model, schema_in, schema_out, order_by, name: str):
    """Generates list / create / update / delete endpoints for a simple table."""

    @router.get(f"/{path}", response_model=list[schema_out], name=f"list_{name}")
    def list_items(db: Session = Depends(get_db)):
        return db.query(model).order_by(*order_by).all()

    @router.post(f"/{path}", response_model=schema_out, status_code=201, name=f"create_{name}")
    def create_item(payload: schema_in, db: Session = Depends(get_db)):
        obj = model(**payload.model_dump())
        db.add(obj)
        _save(db, obj)
        return obj

    @router.put(f"/{path}/{{item_id}}", response_model=schema_out, name=f"update_{name}")
    def update_item(item_id: int, payload: schema_in, db: Session = Depends(get_db)):
        obj = db.get(model, item_id)
        if obj is None:
            raise HTTPException(status_code=404, detail=f"{name} not found")
        for key, value in payload.model_dump().items():
            setattr(obj, key, value)
        _save(db, obj)
        return obj

    @router.delete(f"/{path}/{{item_id}}", status_code=204, name=f"delete_{name}")
    def delete_item(item_id: int, db: Session = Depends(get_db)):
        obj = db.get(model, item_id)
        if obj is None:
            raise HTTPException(status_code=404, detail=f"{name} not found")
        db.delete(obj)
        db.commit()
        return Response(status_code=204)


_crud("pages", models.Page, schemas.PageIn, schemas.PageOut, [models.Page.slug], "page")
_crud(
    "projects",
    models.Project,
    schemas.ProjectIn,
    schemas.ProjectOut,
    [models.Project.sort_order, models.Project.id],
    "project",
)
_crud(
    "services",
    models.Service,
    schemas.ServiceIn,
    schemas.ServiceOut,
    [models.Service.sort_order, models.Service.id],
    "service",
)
_crud(
    "redirects",
    models.Redirect,
    schemas.RedirectIn,
    schemas.RedirectOut,
    [models.Redirect.source_path],
    "redirect",
)


# ---------- blog ----------
def _apply_blog(post: models.BlogPost, payload: schemas.BlogIn) -> None:
    for key, value in payload.model_dump().items():
        setattr(post, key, value)
    # stamp the publish date the first time a post goes live
    if post.status == "published" and post.published_at is None:
        post.published_at = datetime.now(timezone.utc)
    if post.status == "draft":
        post.published_at = None


@router.get("/blog", response_model=list[schemas.BlogOut])
def list_blog(db: Session = Depends(get_db)):
    """All posts, including drafts."""
    return db.query(models.BlogPost).order_by(models.BlogPost.updated_at.desc(), models.BlogPost.id.desc()).all()


@router.post("/blog", response_model=schemas.BlogOut, status_code=201)
def create_blog(payload: schemas.BlogIn, db: Session = Depends(get_db)):
    post = models.BlogPost()
    _apply_blog(post, payload)
    db.add(post)
    _save(db, post)
    return post


@router.put("/blog/{post_id}", response_model=schemas.BlogOut)
def update_blog(post_id: int, payload: schemas.BlogIn, db: Session = Depends(get_db)):
    post = db.get(models.BlogPost, post_id)
    if post is None:
        raise HTTPException(status_code=404, detail="Post not found")
    _apply_blog(post, payload)
    _save(db, post)
    return post


@router.delete("/blog/{post_id}", status_code=204)
def delete_blog(post_id: int, db: Session = Depends(get_db)):
    post = db.get(models.BlogPost, post_id)
    if post is None:
        raise HTTPException(status_code=404, detail="Post not found")
    db.delete(post)
    db.commit()
    return Response(status_code=204)


# ---------- media ----------
# file signatures checked against the actual bytes, not just the browser-reported type
_SIGNATURES = {
    "image/jpeg": (b"\xff\xd8\xff", ".jpg"),
    "image/png": (b"\x89PNG\r\n\x1a\n", ".png"),
    "image/gif": (b"GIF8", ".gif"),
    "image/webp": (None, ".webp"),  # RIFF....WEBP, checked separately
}


def _is_valid_image(content_type: str, data: bytes) -> bool:
    if content_type == "image/webp":
        return data[:4] == b"RIFF" and data[8:12] == b"WEBP"
    magic, _ = _SIGNATURES[content_type]
    return data.startswith(magic)


def _media_out(m: models.MediaFile) -> schemas.MediaOut:
    return schemas.MediaOut(
        id=m.id,
        filename=m.filename,
        original_name=m.original_name,
        content_type=m.content_type,
        size_bytes=m.size_bytes,
        url=f"{settings.public_api_url.rstrip('/')}/media/{m.filename}",
        created_at=m.created_at,
    )


def _media_dir() -> Path:
    path = Path(settings.media_dir)
    path.mkdir(parents=True, exist_ok=True)
    return path


@router.get("/media", response_model=list[schemas.MediaOut])
def list_media(db: Session = Depends(get_db)):
    rows = db.query(models.MediaFile).order_by(models.MediaFile.id.desc()).all()
    return [_media_out(m) for m in rows]


@router.post("/media", response_model=schemas.MediaOut, status_code=201)
async def upload_media(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if file.content_type not in _SIGNATURES:
        raise HTTPException(status_code=415, detail="Only JPG, PNG, GIF or WebP images are allowed")
    limit = settings.media_max_mb * 1024 * 1024
    data = await file.read(limit + 1)
    if len(data) > limit:
        raise HTTPException(status_code=413, detail=f"Image is larger than {settings.media_max_mb} MB")
    if not _is_valid_image(file.content_type, data):
        raise HTTPException(status_code=415, detail="File content does not match an image type")

    ext = _SIGNATURES[file.content_type][1]
    filename = f"{uuid.uuid4().hex}{ext}"
    (_media_dir() / filename).write_bytes(data)
    row = models.MediaFile(
        filename=filename,
        original_name=re.sub(r"[^\w.\- ]", "_", file.filename or filename)[:255],
        content_type=file.content_type,
        size_bytes=len(data),
    )
    db.add(row)
    _save(db, row)
    return _media_out(row)


@router.delete("/media/{media_id}", status_code=204)
def delete_media(media_id: int, db: Session = Depends(get_db)):
    row = db.get(models.MediaFile, media_id)
    if row is None:
        raise HTTPException(status_code=404, detail="File not found")
    (_media_dir() / row.filename).unlink(missing_ok=True)
    db.delete(row)
    db.commit()
    return Response(status_code=204)


# ---------- settings ----------
@router.get("/settings")
def list_settings(db: Session = Depends(get_db)):
    return [{"key": r.key, "value": r.value} for r in db.query(models.SiteSetting).order_by(models.SiteSetting.key)]


@router.put("/settings/{key}")
def put_setting(key: str, payload: schemas.SettingIn, db: Session = Depends(get_db)):
    row = db.get(models.SiteSetting, key)
    if row is None:
        row = models.SiteSetting(key=key, value=payload.value)
        db.add(row)
    else:
        row.value = payload.value
    db.commit()
    return {"key": key, "value": row.value}


@router.get("/leads", response_model=list[schemas.LeadOut])
def list_leads(db: Session = Depends(get_db)):
    return db.query(models.Lead).order_by(models.Lead.created_at.desc(), models.Lead.id.desc()).all()


@router.delete("/leads/{lead_id}", status_code=204)
def delete_lead(lead_id: int, db: Session = Depends(get_db)):
    lead = db.get(models.Lead, lead_id)
    if lead is None:
        raise HTTPException(status_code=404, detail="Lead not found")
    db.delete(lead)
    db.commit()
    return Response(status_code=204)
