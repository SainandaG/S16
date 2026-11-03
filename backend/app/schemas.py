from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---------- auth ----------
class LoginIn(BaseModel):
    email: str
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ---------- SEO (shared by pages and blog posts) ----------
class SeoFields(BaseModel):
    seo_title: str = Field(default="", max_length=200)
    seo_keywords: str = Field(default="", max_length=1000)  # comma-separated
    og_image: str = Field(default="", max_length=500)
    noindex: bool = False


# ---------- pages ----------
class PageIn(SeoFields):
    slug: str = Field(min_length=1, max_length=120, pattern=r"^[a-z0-9-]+$")
    title: str = Field(min_length=1, max_length=200)
    meta_description: str = Field(default="", max_length=500)
    data: dict[str, Any] = Field(default_factory=dict)
    published: bool = True
    canonical_url: str = Field(default="", max_length=500)


class PageOut(ORMModel, PageIn):
    id: int
    updated_at: datetime | None = None


# ---------- blog ----------
class BlogIn(SeoFields):
    slug: str = Field(min_length=1, max_length=160, pattern=r"^[a-z0-9-]+$")
    title: str = Field(min_length=1, max_length=200)
    excerpt: str = Field(default="", max_length=500)
    body: str = ""  # Markdown
    cover_image: str = Field(default="", max_length=500)
    tags: list[str] = Field(default_factory=list)
    status: Literal["draft", "published"] = "draft"
    seo_description: str = Field(default="", max_length=500)


class BlogOut(ORMModel, BlogIn):
    id: int
    published_at: datetime | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


# ---------- media ----------
class MediaOut(ORMModel):
    id: int
    filename: str
    original_name: str
    content_type: str
    size_bytes: int
    url: str
    folder: str = "general"
    storage: str = "local"
    created_at: datetime | None = None


# ---------- projects ----------
class ProjectIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    category: str = Field(min_length=1, max_length=60)
    location: str = ""
    image_url: str = ""
    description: str = ""
    sort_order: int = 0
    published: bool = True


class ProjectOut(ORMModel, ProjectIn):
    id: int


# ---------- services ----------
class ServiceIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str = ""
    items: list[str] = Field(default_factory=list)  # one bullet point per entry
    image_url: str = Field(default="", max_length=500)
    sort_order: int = 0
    published: bool = True


class ServiceOut(ORMModel, ServiceIn):
    id: int


# ---------- leads ----------
class LeadIn(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    email: str = Field(min_length=5, max_length=320, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    phone: str = Field(default="", max_length=50)
    project_type: str = Field(default="", max_length=100)
    budget: str = Field(default="", max_length=100)
    timeline: str = Field(default="", max_length=100)
    message: str = Field(default="", max_length=5000)
    website: str = ""  # honeypot: real users leave this empty


class LeadOut(ORMModel, LeadIn):
    id: int
    created_at: datetime | None = None


# ---------- redirects ----------
class RedirectIn(BaseModel):
    source_path: str = Field(min_length=1, max_length=300, pattern=r"^/.*")
    target_url: str = Field(min_length=1, max_length=500)
    status_code: int = Field(default=301, ge=300, le=308)
    enabled: bool = True


class RedirectOut(ORMModel, RedirectIn):
    id: int


# ---------- settings ----------
class SettingIn(BaseModel):
    value: Any


# ---------- customer accounts ----------
class RegisterIn(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    email: str = Field(min_length=5, max_length=320, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    phone: str = Field(default="", max_length=50)
    password: str = Field(min_length=8, max_length=128)


class CustomerLoginIn(BaseModel):
    email: str = Field(min_length=5, max_length=320)
    password: str = Field(min_length=1, max_length=128)


class CustomerOut(ORMModel):
    id: int
    name: str
    email: str
    phone: str
    created_at: datetime | None = None


class CustomerSession(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str = "customer"  # "customer" or "admin": tells the sign-in page where to go
    customer: CustomerOut | None = None


class ProfileIn(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    phone: str = Field(default="", max_length=50)


# ---------- admin accounts ----------
class AdminUserIn(BaseModel):
    email: str = Field(min_length=5, max_length=320, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    password: str = Field(min_length=8, max_length=128)


class AdminUserOut(ORMModel):
    id: int
    email: str


class PasswordChangeIn(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)
