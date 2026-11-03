import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useList } from "../hooks.js";
import { usePageHead } from "../lib/seo.js";
import { Loading, PageError } from "../components/Status.jsx";
import "./journal.css";

const LISTING_HEAD = {
  title: "Journal",
  meta_description: "Notes on architecture, interiors and building in Hyderabad, from the S16 Design Studio team.",
};

function formatDate(iso) {
  return iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : "";
}

// Shows the cover photo, or a branded panel when a post has no photo yet.
function Cover({ post, large = false }) {
  const [broken, setBroken] = useState(false);
  return (
    <div className={`jr-cover ${large ? "jr-cover-lg" : ""}`}>
      {post.cover_image && !broken ? (
        <img src={post.cover_image} alt={post.title} loading="lazy" onError={() => setBroken(true)} />
      ) : (
        <div className="jr-cover-fallback" aria-hidden="true">
          <span>S16</span>
        </div>
      )}
    </div>
  );
}

export default function Blog() {
  const { items, loading, error } = useList("/api/blog");
  const [tag, setTag] = useState("");
  usePageHead(LISTING_HEAD);

  const tags = useMemo(() => [...new Set(items.flatMap((p) => p.tags || []))].sort(), [items]);
  const visible = tag ? items.filter((p) => (p.tags || []).includes(tag)) : items;
  // the newest post is shown large when nothing is filtered
  const featured = !tag && visible.length > 0 ? visible[0] : null;
  const rest = featured ? visible.slice(1) : visible;

  if (loading) return <Loading />;
  if (error) return <PageError error={error} />;

  return (
    <div>
      <section className="jr-hero">
        <div className="container">
          <p className="jr-eyebrow">Journal</p>
          <h1 className="jr-title">Notes &amp; Ideas</h1>
          <p className="jr-lead">Thoughts on architecture, interiors and building in Hyderabad, from the studio.</p>
          {tags.length > 0 && (
            <div className="jr-filters" role="tablist" aria-label="Filter articles">
              <button className={`jr-chip ${!tag ? "on" : ""}`} onClick={() => setTag("")}>All</button>
              {tags.map((t) => (
                <button key={t} className={`jr-chip ${tag === t ? "on" : ""}`} onClick={() => setTag(t)}>
                  {t}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="container jr-body">
        {featured && (
          <Link to={`/blog/${featured.slug}`} className="jr-feature">
            <Cover post={featured} large />
            <div className="jr-feature-text">
              <p className="jr-meta">{formatDate(featured.published_at)}{featured.tags?.[0] ? ` · ${featured.tags[0]}` : ""}</p>
              <h2 className="jr-feature-title">{featured.title}</h2>
              {featured.excerpt && <p className="jr-excerpt">{featured.excerpt}</p>}
              <span className="jr-more">Read the article →</span>
            </div>
          </Link>
        )}

        {rest.length > 0 && (
          <div className="jr-grid">
            {rest.map((p) => (
              <Link key={p.id} to={`/blog/${p.slug}`} className="jr-card">
                <Cover post={p} />
                <p className="jr-meta">{formatDate(p.published_at)}</p>
                <h3 className="jr-card-title">{p.title}</h3>
                {p.excerpt && <p className="jr-excerpt">{p.excerpt}</p>}
                <span className="jr-more">Read →</span>
              </Link>
            ))}
          </div>
        )}

        {visible.length === 0 && <p className="muted">No articles in this topic yet.</p>}
      </section>
    </div>
  );
}
