"""Adds columns introduced after a table was first created.

`Base.metadata.create_all` creates new tables but never alters existing ones, so
this runs on startup and adds any missing columns. It is safe to run repeatedly.
"""

from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine

# table -> {column: SQL type}. Keep in sync with app/models.py.
ADDITIONS = {
    "pages": {
        "seo_title": "VARCHAR(200)",
        "seo_keywords": "TEXT",
        "og_image": "VARCHAR(500)",
        "canonical_url": "VARCHAR(500)",
        "noindex": "BOOLEAN",
    },
    "services": {
        "items": "JSON",
        "image_url": "VARCHAR(500)",
    },
}


def run(engine: Engine) -> list[str]:
    """Returns the list of 'table.column' names that were added."""
    added: list[str] = []
    insp = inspect(engine)
    with engine.begin() as conn:
        for table, columns in ADDITIONS.items():
            if not insp.has_table(table):
                continue
            existing = {c["name"] for c in insp.get_columns(table)}
            for column, sql_type in columns.items():
                if column in existing:
                    continue
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {sql_type}"))
                # back-fill existing rows with the default the model uses
                default = {"BOOLEAN": "FALSE", "JSON": "'[]'"}.get(sql_type, "''")
                conn.execute(text(f"UPDATE {table} SET {column} = {default} WHERE {column} IS NULL"))
                added.append(f"{table}.{column}")
    return added
