import datetime as dt
import hashlib
import hmac
import os

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from .config import settings
from .db import get_db
from .models import AdminUser, Customer

PBKDF2_ITERATIONS = 200_000
_bearer = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, PBKDF2_ITERATIONS)
    return f"pbkdf2${PBKDF2_ITERATIONS}${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        _, iterations, salt_hex, digest_hex = stored.split("$")
        digest = hashlib.pbkdf2_hmac(
            "sha256", password.encode(), bytes.fromhex(salt_hex), int(iterations)
        )
        return hmac.compare_digest(digest.hex(), digest_hex)
    except ValueError:
        return False


def create_token(email: str, role: str = "admin", expires: dt.timedelta | None = None) -> str:
    now = dt.datetime.now(dt.timezone.utc)
    lifetime = expires or dt.timedelta(minutes=settings.jwt_expire_minutes)
    payload = {"sub": email, "role": role, "exp": now + lifetime}
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def create_customer_token(email: str) -> str:
    return create_token(email, role="customer", expires=dt.timedelta(days=settings.customer_token_days))


def _decode(credentials: HTTPAuthorizationCredentials | None, role: str) -> str:
    if credentials is None:
        raise HTTPException(status_code=401, detail="Not signed in")
    try:
        payload = jwt.decode(credentials.credentials, settings.jwt_secret, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Your session has expired. Please sign in again.")
    if payload.get("role") != role:
        raise HTTPException(status_code=403, detail="Not allowed")
    return payload["sub"]


def require_admin(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> AdminUser:
    email = _decode(credentials, "admin")
    user = db.query(AdminUser).filter_by(email=email).first()
    if user is None:
        raise HTTPException(status_code=401, detail="Unknown user")
    return user


def require_customer(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> Customer:
    email = _decode(credentials, "customer")
    customer = db.query(Customer).filter_by(email=email).first()
    if customer is None:
        raise HTTPException(status_code=401, detail="Account not found")
    return customer
