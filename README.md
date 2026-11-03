# S16 Design Studio — website + admin

- **backend/** — FastAPI + SQLAlchemy, PostgreSQL in production (SQLite for local dev)
- **frontend/** — React + Vite, 3D villa with react-three-fiber / drei
- Content (pages, projects, services, settings) is stored in the database and edited from `/admin`.

## Local setup

### 1. Backend
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate            # Windows (Linux/Mac: source .venv/bin/activate)
pip install -r requirements.txt
copy .env.example .env            # then edit values
python -m app.seed                # creates tables, loads S16 content, creates admin user
uvicorn app.main:app --reload --port 8000
```
API docs: http://localhost:8000/docs

Tests (use an isolated SQLite file):
```bash
python -m pytest -q
```

### 2. Frontend
```bash
cd frontend
npm install
copy .env.example .env            # VITE_API_URL=http://localhost:8000
npm run dev                       # http://localhost:5173
```
Admin: http://localhost:5173/admin (login with `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `.env`)

## Hostinger PostgreSQL

1. In hPanel create a PostgreSQL database and user; note host, port, database, user, password.
2. Put the connection string in `backend/.env`:
   ```
   DATABASE_URL=postgresql+psycopg://USER:PASSWORD@HOST:5432/DBNAME
   ```
   If the host only allows connections from your server, add the server IP in the database's allowed hosts.
3. Run `python -m app.seed` once against it. Tables are created automatically on startup.
4. Set a strong `JWT_SECRET`, change `ADMIN_PASSWORD`, and set `CORS_ORIGINS` to your real frontend domain(s).

## API overview

| Area | Endpoints |
|---|---|
| Public | `GET /api/site`, `GET /api/pages/{slug}`, `GET /api/projects?category=`, `GET /api/services`, `GET /api/resolve?path=`, `POST /api/contact` |
| Admin auth | `POST /api/admin/login` (returns JWT), `GET /api/admin/me` |
| Admin CRUD | `/api/admin/pages`, `/projects`, `/services`, `/redirects` (list/create/update/delete), `/api/admin/settings`, `/api/admin/leads` |

## Deploying the backend

Hostinger shared hosting is not suited to running a FastAPI server. Use a Hostinger **VPS** (Ubuntu):
- run `uvicorn app.main:app --host 127.0.0.1 --port 8000` under **systemd** (or with `gunicorn -k uvicorn.workers.UvicornWorker`),
- put **nginx** in front, proxying `/api/` to port 8000 and serving the built frontend (`frontend/dist`) for everything else,
- add HTTPS with Let's Encrypt (certbot).

Build the frontend with `VITE_API_URL=https://your-domain` set, then `npm run build`.

## Content management (v2)

The admin at `/admin` manages:
- **Pages:** content blocks, plus per-page SEO (title, description, keywords, share image, canonical URL, noindex).
- **Blog (Journal):** Markdown articles with cover image, tags, draft/published status, and SEO fields. Drafts are never shown on the site.
- **Media:** image uploads (JPG, PNG, WebP, GIF; up to `MEDIA_MAX_MB`). Each file's bytes are checked, so renamed non-images are rejected. Files are stored in `MEDIA_DIR` and served at `/media/<file>`.
- **SEO defaults:** site title suffix, default description and keywords, share image, business details (used for Google's structured data).
- Projects, services, site settings, redirects, and enquiries (as before).

**Upgrading an existing database:** the API adds any new columns automatically on startup (`app/migrate.py`). To refresh the navigation and SEO defaults from the seed file, run `python -m app.seed --update-content` once.

**Sitemap and robots on the website domain:** the API serves `/api/sitemap.xml` and `/api/robots.txt`. On the web server, route the root paths to them, for example in nginx:

```nginx
location = /sitemap.xml { proxy_pass http://127.0.0.1:8000/api/sitemap.xml; }
location = /robots.txt  { proxy_pass http://127.0.0.1:8000/api/robots.txt; }
location /media/        { proxy_pass http://127.0.0.1:8000/media/; }
location /api/          { proxy_pass http://127.0.0.1:8000/api/; }
```

Submit `https://<your-domain>/sitemap.xml` in Google Search Console.
