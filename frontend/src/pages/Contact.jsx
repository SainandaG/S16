import { useLayoutEffect, useRef } from "react";
import { usePage, useSite } from "../hooks.js";
import { gsap, revealIn } from "../lib/motion.js";
import { Loading, PageError } from "../components/Status.jsx";
import ContactForm from "../components/ContactForm.jsx";
import { usePageHead } from "../lib/seo.js";

export default function Contact() {
  const ref = useRef(null);
  const page = usePage("contact");
  const { data, error, loading } = page;
  usePageHead(page.record);
  const site = useSite();
  const contact = site?.contact;

  useLayoutEffect(() => {
    if (!data) return;
    const ctx = gsap.context(() => revealIn(ref.current), ref);
    return () => ctx.revert();
  }, [data]);

  if (loading) return <Loading />;
  if (error) return <PageError error={error} />;

  return (
    <div ref={ref}>
      <section className="page-hero">
        <div className="container">
          <p className="eyebrow" data-reveal>Contact</p>
          <h1 className="h-display" data-split>{data.heading}</h1>
        </div>
      </section>

      <section className="section pt-0">
        <div className="container contact-grid">
          <div className="stack-lg">
            <p className="lead" data-reveal>{data.body}</p>
            {contact && (
              <ul className="contact-list" data-reveal>
                <li>
                  <p className="eyebrow">WhatsApp</p>
                  <a href={contact.whatsapp.clickLink} target="_blank" rel="noopener noreferrer">{contact.whatsapp.number}</a>
                </li>
                {contact.phones.map((p) => (
                  <li key={p}>
                    <p className="eyebrow">Phone</p>
                    <a href={`tel:${p.replace(/\s/g, "")}`}>{p}</a>
                  </li>
                ))}
                <li>
                  <p className="eyebrow">Email</p>
                  <a href={`mailto:${contact.email}`}>{contact.email}</a>
                </li>
                <li>
                  <p className="eyebrow">Studio</p>
                  <p className="muted">{contact.headquarters}</p>
                </li>
              </ul>
            )}
          </div>
          <div data-reveal>
            <ContactForm
              heading={data.formHeading}
              fields={data.formFields}
              submitLabel={data.formSubmitLabel}
              successText={data.formSuccess}
              errorText={data.formError}
            />
          </div>
        </div>
        {data.image && (
          <div className="container contact-band">
            <figure className="contact-visual">
              <div className="img-frame"><img src={data.image.image} alt={data.image.caption} loading="lazy" /></div>
              <figcaption className="muted small">{data.image.caption}</figcaption>
            </figure>
          </div>
        )}
        <p className="muted note">{data.ctaBlock}</p>
      </section>
    </div>
  );
}
