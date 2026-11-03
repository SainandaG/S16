import { useLayoutEffect, useRef } from "react";
import { usePage } from "../hooks.js";
import { gsap, revealIn } from "../lib/motion.js";
import { usePageHead } from "../lib/seo.js";
import { Loading, PageError } from "../components/Status.jsx";

export default function About() {
  const ref = useRef(null);
  const page = usePage("about");
  usePageHead(page.record);
  const { data, error, loading } = page;

  useLayoutEffect(() => {
    if (!data) return;
    const ctx = gsap.context(() => revealIn(ref.current), ref);
    return () => ctx.revert();
  }, [data]);

  if (loading) return <Loading />;
  if (error) return <PageError error={error} />;

  return (
    <div ref={ref}>
      {/* full-bleed opener */}
      <section className="about-hero">
        <div className="about-hero-img"><img src={data.hero.image} alt={data.hero.caption} /></div>
        <div className="about-hero-shade" aria-hidden="true" />
        <div className="container about-hero-copy">
          <p className="eyebrow light">About the Studio</p>
          <h1 className="hero-title">{data.heading}</h1>
          <p className="lead light">{data.paragraphs[0]}</p>
        </div>
      </section>

      {/* KPI cards */}
      <section className="kpi-band">
        <div className="container kpi-grid">
          {data.kpis.map((k) => (
            <div key={k.label} className="kpi-card">
              <strong>{k.value}</strong>
              <span>{k.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* story + experience */}
      <section className="section">
        <div className="container story">
          <div className="stack-lg">
            <p className="statement serif" data-reveal>{data.paragraphs[1]}</p>
            {data.paragraphs.slice(2).map((p, i) => (
              <p key={i} className="lead">{p}</p>
            ))}
          </div>
          <div className="experience-card" data-reveal>
            <p className="eyebrow">Experience</p>
            <h3 className="h-md">{data.experience.title}</h3>
            <ul className="experience-list">
              {data.experience.items.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>
        </div>
      </section>

      {/* mission + vision */}
      <section className="section section-alt">
        <div className="container mv-grid">
          <article className="mv-card" data-reveal>
            <p className="eyebrow">Our Mission</p>
            <p className="serif mv-text">{data.mission}</p>
          </article>
          <article className="mv-card" data-reveal>
            <p className="eyebrow">Our Vision</p>
            <p className="serif mv-text">{data.vision}</p>
          </article>
        </div>
      </section>

      {/* philosophy: numbered cards */}
      <section className="section">
        <div className="container">
          <p className="eyebrow" data-reveal>Philosophy</p>
          <h2 className="h-lg" data-reveal>{data.philosophy.statement}</h2>
          <ol className="philo-grid">
            {data.philosophy.points.map((pt, i) => (
              <li key={pt} className="philo-card" data-reveal>
                <span className="philo-no">{String(i + 1).padStart(2, "0")}</span>
                <p>{pt}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* gallery */}
      <section className="section section-alt">
        <div className="container">
          <p className="eyebrow" data-reveal>Our Work</p>
          <h2 className="h-lg" data-reveal>Materials, Light &amp; Proportion</h2>
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

      {/* message band */}
      <section className="message-band">
        <div className="container">
          <p className="eyebrow gold">{data.message.title}</p>
          <p className="message-text serif" data-reveal>{data.message.body}</p>
        </div>
      </section>
    </div>
  );
}
