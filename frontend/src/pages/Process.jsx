import { useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { usePage, useSite } from "../hooks.js";
import { gsap, revealIn, ScrollTrigger, reduceMotion, lenisRef } from "../lib/motion.js";
import { usePageHead } from "../lib/seo.js";
import { Loading, PageError } from "../components/Status.jsx";
import ProcessScene from "../components/ProcessScene.jsx";
import TurnkeyScene from "../components/TurnkeyScene.jsx";

// Index of the step that is active at scroll progress p (0..1).
const STEP_AT = [0, 0.15, 0.3, 0.45, 0.6, 0.8, 0.95];
const stepIndex = (p) => {
  let idx = 0;
  STEP_AT.forEach((at, i) => { if (p >= at) idx = i; });
  return idx;
};

// Preview: open the page at a fixed point, e.g. /process?p=0.6 (build) or /process?k=0.8 (key turned).
const previewParam = (name) => {
  const v = new URLSearchParams(window.location.search).get(name);
  return v === null || Number.isNaN(Number(v)) ? null : Math.min(1, Math.max(0, Number(v)));
};

export default function Process() {
  const ref = useRef(null);
  const processRef = useRef(null);
  const turnkeyRef = useRef(null);
  const turnkeyTextRef = useRef(null);
  const progressRef = useRef(0);
  const turnkeyProgressRef = useRef(0);
  const [active, setActive] = useState(0);
  const page = usePage("process");
  usePageHead(page.record);
  const { data, error, loading } = page;
  const site = useSite();
  const contact = site?.contact;

  // Scroll wiring: section progress drives the 3D build, the step list and the key turn.
  useLayoutEffect(() => {
    if (!data) return;
    const ctx = gsap.context(() => {
      const p = previewParam("p");
      const k = previewParam("k");
      if (p !== null) {
        progressRef.current = p;
        setActive(stepIndex(p));
      } else {
        ScrollTrigger.create({
          trigger: processRef.current,
          start: "top top",
          end: "bottom bottom",
          onUpdate: (self) => {
            progressRef.current = self.progress;
            setActive(stepIndex(self.progress));
          },
        });
      }
      if (k !== null) {
        turnkeyProgressRef.current = k;
      } else {
        ScrollTrigger.create({
          trigger: turnkeyRef.current,
          start: "top top",
          end: "bottom bottom",
          onUpdate: (self) => { turnkeyProgressRef.current = self.progress; },
        });
      }
      revealIn(ref.current);
    }, ref);
    return () => ctx.revert();
  }, [data]);

  if (loading) return <Loading />;
  if (error) return <PageError error={error} />;

  const turnkeyFirst = new URLSearchParams(window.location.search).get("view") === "turnkey";
  const steps = data.steps;

  // Clicking a step scrolls the page to the point where that stage is shown.
  const goToStep = (i) => {
    const sec = processRef.current;
    if (!sec) return;
    const top = sec.getBoundingClientRect().top + window.scrollY;
    const range = sec.offsetHeight - window.innerHeight;
    const y = top + range * (STEP_AT[i] + 0.005);
    if (lenisRef.current) lenisRef.current.scrollTo(y);
    else window.scrollTo({ top: y, behavior: reduceMotion ? "auto" : "smooth" });
  };
  const current = steps[active] ?? steps[0];

  return (
    <div ref={ref}>
      {turnkeyFirst && (
      <section className="turnkey-section" ref={turnkeyRef}>
        <div className="turnkey-sticky">
          <TurnkeyScene progressRef={turnkeyProgressRef} textRef={turnkeyTextRef} />
          <div className="turnkey-text" ref={turnkeyTextRef} style={{ opacity: reduceMotion ? 1 : 0 }}>
            <div className="turnkey-inner">
              <p className="eyebrow gold">{data.turnkey.eyebrow}</p>
              <h2 className="h-display">{data.turnkey.title}</h2>
              <p className="tagline">{data.turnkey.tagline}</p>
              <p className="muted-light">{data.turnkey.line}</p>
              <ul className="checks">
                {data.turnkey.checks.map((c) => (
                  <li key={c}><span className="check-dot">✓</span>{c}</li>
                ))}
              </ul>
            </div>
          </div>
          <p className="turnkey-hint">Scroll to turn the key</p>
        </div>
      </section>
      )}
      <section className="process-section" ref={processRef}>
        <div className="process-sticky">
          <div className="process-copy">
            <p className="eyebrow">Our Methodology</p>
            <h1 className="h-display" data-split>{data.heading}</h1>
            <ol className="step-list">
              {steps.map((s, i) => (
                <li
                  key={s.number}
                  className={`step-item ${i === active ? "active" : ""}`}
                  role="button"
                  tabIndex={0}
                  aria-current={i === active ? "step" : undefined}
                  onClick={() => goToStep(i)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); goToStep(i); } }}
                >
                  <span className="step-num">{s.number}</span>
                  <span className="step-name">{s.title}</span>
                  <p className="step-text">{s.description}</p>
                </li>
              ))}
            </ol>
            <div className="step-caption">
              <p className="eyebrow gold">{current.number} / {String(steps.length).padStart(2, "0")}</p>
              <h2 className="h-md">{current.title}</h2>
              <p className="muted">{current.description}</p>
            </div>
          </div>
          <div className="process-stage">
            <ProcessScene progressRef={progressRef} />
            <p className="stage-hint">Scroll to build the villa</p>
          </div>
        </div>
      </section>

      {!turnkeyFirst && (
      <section className="turnkey-section" ref={turnkeyRef}>
        <div className="turnkey-sticky">
          <TurnkeyScene progressRef={turnkeyProgressRef} textRef={turnkeyTextRef} />
          <div className="turnkey-text" ref={turnkeyTextRef} style={{ opacity: reduceMotion ? 1 : 0 }}>
            <div className="turnkey-inner">
              <p className="eyebrow gold">{data.turnkey.eyebrow}</p>
              <h2 className="h-display">{data.turnkey.title}</h2>
              <p className="tagline">{data.turnkey.tagline}</p>
              <p className="muted-light">{data.turnkey.line}</p>
              <ul className="checks">
                {data.turnkey.checks.map((c) => (
                  <li key={c}><span className="check-dot">✓</span>{c}</li>
                ))}
              </ul>
            </div>
          </div>
          <p className="turnkey-hint">Scroll to turn the key</p>
        </div>
      </section>
      )}
      <section className="section">
        <div className="container">
          <p className="eyebrow" data-reveal>In Practice</p>
          <h2 className="h-lg" data-split>Study, Visualise, Build</h2>
          <div className="process-strip">
            {data.strip.map((s) => (
              <figure key={s.title} data-reveal style={{ margin: 0 }}>
                <div className="img-frame"><img src={s.image} alt={s.title} loading="lazy" /></div>
                <figcaption className="muted small" style={{ marginTop: 12 }}><strong className="serif" style={{ color: "var(--fg)", fontSize: "1.2rem", fontWeight: 500 }}>{s.title}</strong> · {s.caption}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      <section className="cta-band">
        <div className="container cta-inner">
          <div>
            <p className="eyebrow">Hyderabad · Bangalore · Vijayawada · Vizag</p>
            <h2 className="h-lg">Start Your Project in Hyderabad</h2>
          </div>
          <div className="btn-row">
            {contact?.whatsapp?.clickLink && (
              <a href={contact.whatsapp.clickLink} target="_blank" rel="noopener noreferrer" className="btn btn-solid">
                Contact Us on WhatsApp
              </a>
            )}
            <Link to="/contact" className="btn">Book Site Visit</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
