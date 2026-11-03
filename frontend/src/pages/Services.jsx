import { useLayoutEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { usePage, useList } from "../hooks.js";
import { gsap, revealIn } from "../lib/motion.js";
import { usePageHead } from "../lib/seo.js";
import { Loading, PageError } from "../components/Status.jsx";

const num = (i) => String(i + 1).padStart(2, "0");

export default function Services() {
  const ref = useRef(null);
  const page = usePage("services");
  usePageHead(page.record);
  const list = useList("/api/services");
  const { data } = page;

  useLayoutEffect(() => {
    if (!data || list.loading) return;
    const ctx = gsap.context(() => revealIn(ref.current), ref);
    return () => ctx.revert();
  }, [data, list.loading]);

  if (page.loading || list.loading) return <Loading />;
  if (page.error) return <PageError error={page.error} />;
  if (list.error) return <PageError error={list.error} />;

  return (
    <div ref={ref}>
      <section className="page-hero">
        <div className="container">
          <p className="eyebrow">What We Offer</p>
          <h1 className="h-display">{data.heading}</h1>
          <p className="lead">{data.subheading}</p>
        </div>
      </section>

      <section className="section pt-0">
        <div className="container svc-cards">
          {list.items.map((s, i) => (
            <article key={s.id} className="svc-card" id={`service-${s.id}`}>
              {s.image_url && (
                <div className="svc-img"><img src={s.image_url} alt={s.title} loading="lazy" /></div>
              )}
              <div className="svc-body">
                <span className="svc-no">{num(i)}</span>
                <h2 className="h-md">{s.title}</h2>
                {s.description && <p className="muted svc-desc">{s.description}</p>}
                {s.items.length > 0 && (
                  <ul className="svc-tags">
                    {s.items.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                )}
              </div>
            </article>
          ))}
        </div>
        {list.items.length === 0 && <p className="container muted">Our services will be listed here.</p>}
      </section>

      <section className="cta-band">
        <div className="container cta-inner">
          <h2 className="h-lg">Get started with the right service for your space</h2>
          <Link to="/contact" className="btn btn-solid">Get Started</Link>
        </div>
      </section>
    </div>
  );
}
