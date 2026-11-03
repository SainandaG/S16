"""Customer accounts on the public website: register, sign in, profile, and own enquiries."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from . import models, schemas
from .db import get_db
from .security import create_customer_token, create_token, hash_password, require_customer, verify_password

router = APIRouter(prefix="/api/auth", tags=["customer-auth"])


def _session(customer: models.Customer) -> schemas.CustomerSession:
    return schemas.CustomerSession(
        access_token=create_customer_token(customer.email),
        customer=schemas.CustomerOut.model_validate(customer),
    )


@router.post("/register", response_model=schemas.CustomerSession, status_code=201)
def register(payload: schemas.RegisterIn, db: Session = Depends(get_db)):
    email = payload.email.strip().lower()
    if db.query(models.Customer).filter_by(email=email).first():
        raise HTTPException(status_code=409, detail="An account with this email already exists. Please sign in.")
    customer = models.Customer(
        name=payload.name.strip(),
        email=email,
        phone=payload.phone.strip(),
        password_hash=hash_password(payload.password),
    )
    db.add(customer)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="An account with this email already exists. Please sign in.")
    db.refresh(customer)
    return _session(customer)


@router.post("/login", response_model=schemas.CustomerSession)
def login(payload: schemas.CustomerLoginIn, db: Session = Depends(get_db)):
    """One sign-in for everyone. Customer accounts are checked first, then admin accounts."""
    email = payload.email.strip().lower()
    customer = db.query(models.Customer).filter_by(email=email).first()
    if customer is not None and verify_password(payload.password, customer.password_hash):
        return _session(customer)
    admin = db.query(models.AdminUser).filter_by(email=email).first()
    if admin is not None and verify_password(payload.password, admin.password_hash):
        return schemas.CustomerSession(access_token=create_token(admin.email, role="admin"), role="admin")
    # same message whichever check failed, so accounts cannot be discovered
    raise HTTPException(status_code=401, detail="Email or password is incorrect.")


@router.get("/me", response_model=schemas.CustomerOut)
def me(customer: models.Customer = Depends(require_customer)):
    return customer


@router.put("/me", response_model=schemas.CustomerOut)
def update_me(payload: schemas.ProfileIn, customer: models.Customer = Depends(require_customer), db: Session = Depends(get_db)):
    customer.name = payload.name.strip()
    customer.phone = payload.phone.strip()
    db.commit()
    db.refresh(customer)
    return customer


@router.get("/enquiries", response_model=list[schemas.LeadOut])
def my_enquiries(customer: models.Customer = Depends(require_customer), db: Session = Depends(get_db)):
    """Enquiries sent with this account's email address."""
    return (
        db.query(models.Lead)
        .filter(models.Lead.email == customer.email)
        .order_by(models.Lead.created_at.desc(), models.Lead.id.desc())
        .all()
    )
