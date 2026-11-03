import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useList } from "../hooks.js";
import { usePageHead } from "../lib/seo.js";
import { Loading, PageError } from "../components/Status.jsx";

const LISTING_HEAD = {
  title: "Journal",
  meta_description: "Notes on architecture, interiors and building in Hyderabad, from the S16 Design Studio team.",
};

function formatDate(iso) {
  return iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : "";
}

export default function Blog() {
  const { items, loading, error } = useList("/api/blog");
  const [tag, setTag] = useState("");
  usePageHead(LISTING_HEAD);

  const tags = useMemo(() => [...new Set(items.flatMap((p) => p.tags || []))].sort(), [items]);
  const visible = tag ? items.filter((p) => (p.tags || []).includes(tag)) : items;

  if (loading) return <Loading />;
  if (error) return <PageError error={error} />;

  return (
    <div>
      <section className="page-hero">
        <div className="container">
          <p className="eyebrow">Journal</p>
          <h1 className="h-display">Notes &amp; Ideas</h1>
          {tags.length > 0 && (
            <div className="filters">
              <button className={`filter-btn ${!tag ? "active" : ""}`} onClick={() => setTag("")}>All</button>
              {tags.map((t) => (
                <button key={t} className={`filter-btn ${tag === t ? "active" : ""}`} onClick={() => setTag(t)}>{t}</button>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="section pt-0">
        <div className="container post-grid">
          {visible.map((p) => (
            <Link key={p.id} to={`/blog/${p.slug}`} className="post-card">
              {p.cover_image && (
                <div className="post-media"><img src={p.cover_image} alt={p.title} loading="lazy" /></div>
              )}
              <p className="eyebrow gold">{formatDate(p.published_at)}</p>
              <h2 className="h-md">{p.title}</h2>
              {p.excerpt && <p className="muted">{p.excerpt}</p>}
            </Link>
          ))}
          {visible.length === 0 && <p className="muted">No articles yet.</p>}
        </div>
      </section>
    </div>
  );
}
