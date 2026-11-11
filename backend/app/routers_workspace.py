"""Client workspace: customers request a design and follow its progress; admins post updates.

A project's timeline is a list of ProjectUpdate rows. Each row can carry a note, images and a
status change. The customer's first row is the brief and reference images they sent.
"""

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from . import models, storage
from .db import get_db
from .routers_media import MAX_BYTES, _is_image
from .security import require_admin, require_customer

STATUSES = ["requested", "concept", "design", "approved", "execution", "completed"]
MAX_FILES = 10
MAX_TEXT = 4000

customer_router = APIRouter(prefix="/api/workspace", tags=["workspace"])
admin_router = APIRouter(prefix="/api/admin/workspace", tags=["admin-workspace"], dependencies=[Depends(require_admin)])


async def _save_images(files: list[UploadFile]) -> list[dict]:
    """Checks each file is a real image under the size limit, then stores it in the Client work folder."""
    if len(files) > MAX_FILES:
        raise HTTPException(status_code=422, detail=f"Add up to {MAX_FILES} images at a time")
    saved = []
    for file in files:
        if file.content_type not in storage.EXTENSIONS:
            raise HTTPException(status_code=415, detail="Only JPG, PNG, GIF or WebP images are allowed")
        data = await file.read(MAX_BYTES + 1)
        if len(data) > MAX_BYTES:
            raise HTTPException(status_code=413, detail="Each image must be 8 MB or smaller")
        if not _is_image(file.content_type, data):
            raise HTTPException(status_code=415, detail="A file does not match an image type")
        result = storage.save_image(data, "clients", file.content_type)
        saved.append({"url": result["url"], "public_id": result["public_id"], "storage": result["storage"]})
    return saved


def _project_out(p: models.ClientProject, customer: models.Customer | None = None) -> dict:
    data = {
        "id": p.id,
        "title": p.title,
        "brief": p.brief,
        "status": p.status,
        "created_at": p.created_at,
        "updated_at": p.updated_at,
    }
    if customer is not None:
        data.update(customer_name=customer.name, customer_email=customer.email, customer_phone=customer.phone)
    return data


def _update_out(u: models.ProjectUpdate) -> dict:
    return {
        "id": u.id,
        "author_role": u.author_role,
        "author_name": u.author_name,
        "note": u.note,
        "status": u.status,
        "images": u.images or [],
        "created_at": u.created_at,
    }


def _timeline(db: Session, project_id: int) -> list[dict]:
    rows = db.query(models.ProjectUpdate).filter_by(project_id=project_id).order_by(models.ProjectUpdate.id).all()
    return [_update_out(u) for u in rows]


def _owned(db: Session, project_id: int, customer: models.Customer) -> models.ClientProject:
    project = db.get(models.ClientProject, project_id)
    # Another customer's project looks the same as one that does not exist.
    if project is None or project.customer_id != customer.id:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


# ---------- customer ----------

@customer_router.get("/projects")
def my_projects(customer: models.Customer = Depends(require_customer), db: Session = Depends(get_db)):
    rows = db.query(models.ClientProject).filter_by(customer_id=customer.id).order_by(models.ClientProject.id.desc()).all()
    return [_project_out(p) for p in rows]


@customer_router.post("/projects", status_code=201)
async def request_project(
    title: str = Form(..., min_length=2, max_length=200),
    brief: str = Form("", max_length=MAX_TEXT),
    files: list[UploadFile] = File(default=[]),
    customer: models.Customer = Depends(require_customer),
    db: Session = Depends(get_db),
):
    brief = brief.strip()
    images = await _save_images(files)
    project = models.ClientProject(customer_id=customer.id, title=title.strip(), brief=brief, status="requested")
    db.add(project)
    db.flush()
    db.add(
        models.ProjectUpdate(
            project_id=project.id,
            author_role="customer",
            author_name=customer.name,
            note=brief,
            status="requested",
            images=images,
        )
    )
    db.commit()
    db.refresh(project)
    return _project_out(project)


@customer_router.get("/projects/{project_id}")
def my_project(project_id: int, customer: models.Customer = Depends(require_customer), db: Session = Depends(get_db)):
    project = _owned(db, project_id, customer)
    return {**_project_out(project), "updates": _timeline(db, project.id)}


@customer_router.post("/projects/{project_id}/updates", status_code=201)
async def customer_update(
    project_id: int,
    note: str = Form("", max_length=MAX_TEXT),
    files: list[UploadFile] = File(default=[]),
    customer: models.Customer = Depends(require_customer),
    db: Session = Depends(get_db),
):
    project = _owned(db, project_id, customer)
    note = note.strip()
    images = await _save_images(files)
    if not note and not images:
        raise HTTPException(status_code=422, detail="Add a note or an image")
    update = models.ProjectUpdate(
        project_id=project.id,
        author_role="customer",
        author_name=customer.name,
        note=note,
        status=project.status,
        images=images,
    )
    db.add(update)
    db.commit()
    db.refresh(update)
    return _update_out(update)


# ---------- admin ----------

def _admin_project(db: Session, project_id: int) -> tuple[models.ClientProject, models.Customer]:
    row = (
        db.query(models.ClientProject, models.Customer)
        .join(models.Customer, models.Customer.id == models.ClientProject.customer_id)
        .filter(models.ClientProject.id == project_id)
        .first()
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return row


@admin_router.get("/projects")
def all_projects(db: Session = Depends(get_db)):
    rows = (
        db.query(models.ClientProject, models.Customer)
        .join(models.Customer, models.Customer.id == models.ClientProject.customer_id)
        .order_by(models.ClientProject.id.desc())
        .all()
    )
    return [_project_out(p, c) for p, c in rows]


@admin_router.get("/projects/{project_id}")
def project_detail(project_id: int, db: Session = Depends(get_db)):
    project, customer = _admin_project(db, project_id)
    return {**_project_out(project, customer), "updates": _timeline(db, project.id)}


@admin_router.post("/projects/{project_id}/updates", status_code=201)
async def post_update(
    project_id: int,
    note: str = Form("", max_length=MAX_TEXT),
    status: str = Form(""),
    files: list[UploadFile] = File(default=[]),
    db: Session = Depends(get_db),
):
    project, _ = _admin_project(db, project_id)
    note = note.strip()
    new_status = status.strip() or project.status
    if new_status not in STATUSES:
        raise HTTPException(status_code=422, detail="Unknown status")
    images = await _save_images(files)
    if not note and not images and new_status == project.status:
        raise HTTPException(status_code=422, detail="Add a note, an image or a status change")
    project.status = new_status
    update = models.ProjectUpdate(
        project_id=project.id,
        author_role="admin",
        author_name="S16 Design Studio",
        note=note,
        status=new_status,
        images=images,
    )
    db.add(update)
    db.commit()
    db.refresh(update)
    return _update_out(update)
