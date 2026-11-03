import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { usePage, useList } from "../hooks.js";
import { gsap, revealIn, reduceMotion } from "../lib/motion.js";
import { usePageHead } from "../lib/seo.js";
import { Loading, PageError } from "../components/Status.jsx";

const HERO_IMAGE = "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=2400&q=80";

export default function Home() {
  const ref = useRef(null);
  const sliderRef = useRef(null);
  const home = usePage("home");
  usePageHead(home.record);
  const about = usePage("about");
  const services = usePage("services");
  const projects = useList("/api/projects");
  const serviceList = useList("/api/services");
  const data = home.data;
  const [heroSlide, setHeroSlide] = useState(0);
  const slides = data ? [HERO_IMAGE, ...data.gallery.map((g) => g.image)] : [];
  useEffect(() => {
    if (reduceMotion || slides.length < 2) return undefined;
    const t = setInterval(() => setHeroSlide((i) => (i + 1) % slides.length), 5500);
    return () => clearInterval(t);
  }, [slides.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => {
    if (!data) return;
    const ctx = gsap.context(() => revealIn(ref.current), ref);
    return () => ctx.revert();
  }, [data, services.data]);

  if (home.loading) return <Loading />;
  if (home.error) return <PageError error={home.error} />;

  const featured = projects.items.slice(0, 5);
  const slide = (dir) => {
    const el = sliderRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * ((el.querySelector(".slide")?.offsetWidth ?? 300) + 24), behavior: "smooth" });
  };

  return (
    <div ref={ref}>
      <section className="hero hero-cinema">
        {slides.map((src, i) => (
          <div key={src} className={`hero-slide ${i === heroSlide ? "on" : ""}`} style={{ backgroundImage: `url(${src})` }} aria-hidden="true" />
        ))}
        <div className="hero-shade" aria-hidden="true" />
        <div className="container hero-content">
          <p className="eyebrow">{data.hero.eyebrow}</p>
          <h1 className="hero-title">We Shape What You Feel.</h1>
          <p className="lead light hero-lead">{data.hero.body}</p>
          <div className="btn-row">
            <Link to="/contact" className="btn btn-gold">Book a free site visit</Link>
            <Link to="/projects" className="btn btn-ghost">See our projects</Link>
          </div>
          <p className="trust-row">
            <span>ISO 9001:2015</span><span>COA Registered</span><span>RERA Approved</span>
          </p>
        </div>
        <div className="hero-dots" aria-hidden="true">
          {slides.map((_, i) => <span key={i} className={i === heroSlide ? "on" : ""} />)}
        </div>
      </section>

      <section className="section">
        <div className="container intro">
          <div data-reveal>
            <p className="eyebrow">{data.intro.eyebrow}</p>
            <h2 className="h-lg" data-split>{data.intro.title}</h2>
            <p className="lead" data-reveal>{data.intro.body}</p>
            <Link to="/about" className="link-arrow">About the studio →</Link>
          </div>
          <figure className="img-frame" data-reveal style={{ margin: 0 }}>
            <img src={data.intro.image} alt={data.intro.caption} loading="lazy" />
          </figure>
        </div>
      </section>

      <section className="stats">
        <div className="container stats-grid">
          {data.stats.map((s) => (
            <div key={s.label} className="stat" data-reveal>
              <strong>{s.value}</strong>
              <span>{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="container">
          <p className="eyebrow" data-reveal>Recent Work</p>
          <h2 className="h-lg" data-split>Built, Lived In, Loved</h2>
          <div className="gallery">
            {data.gallery.map((g) => (
              <figure key={g.title} data-reveal>
                <div className="img-frame"><img src={g.image} alt={g.title} loading="lazy" /></div>
                <figcaption><strong>{g.title}</strong>{g.caption}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      <section className="section section-alt">
        <div className="container">
          <div className="row" data-reveal style={{ marginBottom: 40 }}>
            <div>
              <p className="eyebrow">Featured</p>
              <h2 className="h-lg" style={{ margin: 0 }}>Selected Projects</h2>
            </div>
            <div className="slider-nav">
              <button className="btn btn-sm" onClick={() => slide(-1)} aria-label="Previous project">←</button>
              <button className="btn btn-sm" onClick={() => slide(1)} aria-label="Next project">→</button>
            </div>
          </div>
          <div className="slider" ref={sliderRef}>
            {featured.map((p) => (
              <Link key={p.id} to="/projects" className="slide">
                <div className="img-frame">
                  {p.image_url && <img src={p.image_url} alt={p.title} loading="lazy" />}
                </div>
                <p className="eyebrow">{p.category} · {p.location}</p>
                <h3 className="h-md">{p.title}</h3>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <p className="eyebrow" data-reveal>What We Do</p>
          <h2 className="h-lg" data-split>{services.data?.heading}</h2>
          <div className="pillars">
            {serviceList.items.map((service) => (
              <article key={service.id} className="pillar" data-reveal>
                {service.image_url && (
                  <div className="img-frame"><img src={service.image_url} alt={service.title} loading="lazy" /></div>
                )}
                <h3 className="h-md">{service.title}</h3>
                <ul>
                  {service.items.slice(0, 3).map((i) => <li key={i}>{i}</li>)}
                </ul>
              </article>
            ))}
          </div>
          <Link to="/services" className="link-arrow">View all services →</Link>
        </div>
      </section>

      <section className="section section-alt">
        <div className="container cert-row">
          {data.certifications.map((c) => (
            <article key={c.title} className="cert" data-reveal>
              <h3 className="h-md">{c.title}</h3>
              <p className="muted">{c.desc}</p>
            </article>
          ))}
        </div>
        {about.data && (
          <div className="container statement-block" data-reveal>
            <p className="statement serif">{about.data.philosophy.statement}</p>
          </div>
        )}
      </section>

      <section className="cta-band">
        <div className="container cta-inner">
          <h2 className="h-lg">Ready to build something extraordinary?</h2>
          <Link to="/contact" className="btn btn-solid">{data.consultationCta}</Link>
        </div>
      </section>
    </div>
  );
}
