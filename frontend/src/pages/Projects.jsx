import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { usePage, useList } from "../hooks.js";
import { gsap, revealIn, reduceMotion } from "../lib/motion.js";
import { usePageHead } from "../lib/seo.js";
import { Loading, PageError } from "../components/Status.jsx";
import "./projects.css";

// Filter labels shown to visitors -> category stored on each project in the database.
const CATEGORY_FOR = { All: null, Residential: "Residential", Villas: "Villas", Commercial: "Commercial" };

// Full-screen viewer for one project, with keyboard support (Esc, arrow keys).
function Viewer({ items, index, onClose, onMove }) {
  const p = items[index];
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onMove(1);
      if (e.key === "ArrowLeft") onMove(-1);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose, onMove]);

  return (
    <div className="viewer" role="dialog" aria-modal="true" aria-label={p.title} onClick={onClose}>
      <div className="viewer-box" onClick={(e) => e.stopPropagation()}>
        <button className="viewer-close" onClick={onClose} aria-label="Close">Close ✕</button>
        <div className="viewer-media">
          <img src={p.image_url} alt={p.title} />
        </div>
        <div className="viewer-info">
          <p className="eyebrow">{p.category} · {p.location}</p>
          <h2 className="h-lg">{p.title}</h2>
          <p className="lead">{p.description}</p>
          <div className="viewer-nav">
            <button className="btn btn-sm" onClick={() => onMove(-1)} aria-label="Previous project">← Previous</button>
            <span className="muted small">{index + 1} / {items.length}</span>
            <button className="btn btn-sm" onClick={() => onMove(1)} aria-label="Next project">Next →</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Projects() {
  const ref = useRef(null);
  const page = usePage("portfolio");
  usePageHead(page.record);
  const list = useList("/api/projects");
  const [filter, setFilter] = useState("All");
  const [viewing, setViewing] = useState(null); // index into `visible`
  const [active, setActive] = useState(0); // row previewed on desktop
  const [gridKey, setGridKey] = useState(0);

  const counts = useMemo(() => {
    const c = { All: list.items.length };
    for (const label of Object.keys(CATEGORY_FOR)) {
      if (CATEGORY_FOR[label]) c[label] = list.items.filter((p) => p.category === CATEGORY_FOR[label]).length;
    }
    return c;
  }, [list.items]);

  const visible = useMemo(() => {
    const cat = CATEGORY_FOR[filter];
    return cat ? list.items.filter((p) => p.category === cat) : list.items;
  }, [filter, list.items]);

  const current = Math.min(active, Math.max(visible.length - 1, 0));

  useLayoutEffect(() => {
    if (!page.data) return;
    const ctx = gsap.context(() => revealIn(ref.current), ref);
    return () => ctx.revert();
  }, [page.data]);

  // Animate the rows in whenever the filter changes.
  useLayoutEffect(() => {
    if (reduceMotion || gridKey === 0) return;
    gsap.fromTo(".pv-row", { opacity: 0, x: -24 }, { opacity: 1, x: 0, duration: 0.7, stagger: 0.06, ease: "power3.out" });
  }, [gridKey]);

  const move = (dir) =>
    setViewing((i) => (i === null ? null : (i + dir + visible.length) % visible.length));
  const choose = (label) => {
    setFilter(label);
    setActive(0);
    setGridKey((k) => k + 1);
  };

  if (page.loading || list.loading) return <Loading />;
  if (page.error) return <PageError error={page.error} />;
  if (list.error) return <PageError error={list.error} />;

  return (
    <div ref={ref}>
      <section className="page-hero projects-hero">
        <div className="container">
          <p className="eyebrow" data-reveal>Projects</p>
          <h1 className="h-display" data-split>{page.data.heading}</h1>
          <p className="lead" data-reveal>
            {list.items.length} projects across Hyderabad: villas, residences and commercial interiors, from concept to handover.
          </p>
          <div className="filters filter-bar" data-reveal>
            {page.data.filters.map((label) => (
              <button key={label} className={`filter-btn ${filter === label ? "active" : ""}`} onClick={() => choose(label)}>
                {label} <span className="filter-count">{counts[label] ?? 0}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="section projects-list">
        <div className="container pv-wrap" key={gridKey}>
          {visible.length === 0 ? (
            <p className="pv-empty">No projects in this category yet.</p>
          ) : (
            <>
              <ol className="pv-index">
                {visible.map((p, i) => (
                  <li key={p.id}>
                    <button
                      className={`pv-row ${current === i ? "on" : ""}`}
                      onMouseEnter={() => setActive(i)}
                      onFocus={() => setActive(i)}
                      onClick={() => setViewing(i)}
                      aria-label={`View ${p.title}`}
                    >
                      <span className="pv-num">{String(i + 1).padStart(2, "0")}</span>
                      <span className="pv-main">
                        <span className="pv-title">{p.title}</span>
                        <span className="pv-meta">{p.category} · {p.location}</span>
                      </span>
                      <span className="pv-thumb"><img src={p.image_url} alt="" loading="lazy" /></span>
                      <span className="pv-arrow" aria-hidden="true">→</span>
                    </button>
                  </li>
                ))}
              </ol>

              <aside className="pv-preview" aria-hidden="true">
                {visible.map((p, i) => (
                  <img key={p.id} src={p.image_url} alt="" loading="lazy" className={current === i ? "on" : ""} />
                ))}
                <span className="pv-preview-cap">{visible[current]?.category}</span>
              </aside>
            </>
          )}
        </div>
      </section>

      {viewing !== null && visible[viewing] && (
        <Viewer items={visible} index={viewing} onClose={() => setViewing(null)} onMove={move} />
      )}
    </div>
  );
}
