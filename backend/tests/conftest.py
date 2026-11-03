"""Test environment. Must be set before the app is imported, so it lives here."""
import os

os.environ["DATABASE_URL"] = "sqlite:///./test_tmp.db"
os.environ["ADMIN_EMAIL"] = "admin@test.local"
os.environ["ADMIN_PASSWORD"] = "test-password"
os.environ["JWT_SECRET"] = "test-secret"
os.environ["MEDIA_DIR"] = "test_media_tmp"
os.environ["PUBLIC_SITE_URL"] = "https://example.test"
os.environ["PUBLIC_API_URL"] = "https://api.example.test"
