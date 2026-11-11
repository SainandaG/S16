import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useCustomer, useSite } from "../hooks.js";
import { jumpToTop, startSmoothScroll } from "../lib/motion.js";
import { currentTheme, toggleTheme } from "../lib/theme.js";
import Intro from "./Intro.jsx";

function ThemeIcon({ theme }) {
  // shows the mode you will switch to
  return theme === "dark" ? (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" /></svg>
  );
}

export default function Layout() {
  const site = useSite();
  const { pathname } = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [theme, setThemeState] = useState(currentTheme);
  const { customer } = useCustomer();

  // Lenis smooth scrolling for the whole site (not the admin).
  useEffect(() => startSmoothScroll(), []);

  // New page -> start at the top, close the mobile menu.
  useEffect(() => {
    jumpToTop();
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const nav = site?.navigation ?? [];
  const contact = site?.contact;
  const footer = site?.footer;
  const whatsapp = contact?.whatsapp?.clickLink;

  return (
    <div className="app">
      <Intro />
      <header className={`site-header ${scrolled ? "scrolled" : ""}`}>
        <div className="container header-inner">
          <Link to="/" className="brand" aria-label="S16 Design Studio home">
            <img src="/logo.png" alt="S16 Design Studio" />
          </Link>
          <nav className="nav-desktop">
            {nav.map((item) => (
              <NavLink key={item.path} to={item.path} end={item.path === "/"} className="nav-link">
                {item.name}
              </NavLink>
            ))}
          </nav>
          <div className="header-actions">
            <button className="theme-btn" aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`} title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`} onClick={() => setThemeState(toggleTheme())}>
              <ThemeIcon theme={theme} />
            </button>
            {customer ? (
              <Link to="/account" className="header-account hide-mobile">Hi, {customer.name.split(" ")[0]}</Link>
            ) : (
              <Link to="/login" className="header-account hide-mobile">Sign in</Link>
            )}
            <Link to="/contact" className="btn btn-solid btn-sm hide-mobile">Book Consultation</Link>
            <button className="menu-btn" aria-label="Open menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}>
              <span /><span />
            </button>
          </div>
        </div>
      </header>

      <div className={`mobile-menu ${menuOpen ? "open" : ""}`}>
        <button className="menu-close" onClick={() => setMenuOpen(false)} aria-label="Close menu">Close</button>
        <nav>
          {nav.map((item) => (
            <NavLink key={item.path} to={item.path} end={item.path === "/"} onClick={() => setMenuOpen(false)}>
              {item.name}
            </NavLink>
          ))}
        </nav>
        <div className="mobile-menu-account">
          {customer ? (
            <Link to="/account" onClick={() => setMenuOpen(false)}>My account ({customer.name.split(" ")[0]})</Link>
          ) : (
            <Link to="/login" onClick={() => setMenuOpen(false)}>Sign in</Link>
          )}
          <Link to="/contact" className="btn btn-solid" onClick={() => setMenuOpen(false)}>Book Consultation</Link>
        </div>
      </div>

      <main>
        <Outlet />
      </main>

      <footer className="site-footer">
        <div className="container footer-grid">
          <div className="footer-brand">
            <img src="/logo.png" alt="S16 Design Studio" className="footer-logo" />
            <p className="footer-tagline serif">We Shape What You Feel.</p>
            <p className="footer-muted">{footer?.description}</p>
          </div>

          <div>
            <p className="footer-heading">Explore</p>
            <ul className="footer-links">
              {nav.map((item) => (
                <li key={item.path}><Link to={item.path}>{item.name}</Link></li>
              ))}
            </ul>
          </div>

          <div>
            <p className="footer-heading">Visit</p>
            <ul className="footer-list footer-muted">
              {contact?.headquarters && <li>{contact.headquarters}</li>}
              {contact?.phones?.map((p) => (
                <li key={p}><a href={`tel:${p.replace(/\s/g, "")}`}>{p}</a></li>
              ))}
            </ul>
          </div>

          <div>
            <p className="footer-heading">Connect</p>
            <ul className="footer-list footer-muted">
              {contact?.email && <li><a href={`mailto:${contact.email}`}>{contact.email}</a></li>}
              {whatsapp && <li><a href={whatsapp} target="_blank" rel="noopener noreferrer">WhatsApp</a></li>}
              {contact?.social?.instagram && (
                <li><a href={contact.social.instagram} target="_blank" rel="noopener noreferrer">Instagram</a></li>
              )}
            </ul>
            {contact?.servingCities && (
              <p className="footer-muted footer-serving">Serving {contact.servingCities.join(" · ")}</p>
            )}
          </div>
        </div>
        <div className="container footer-bottom">
          <span>{site?.site?.copyright}</span>
          <span>{(footer?.legal ?? []).join(" · ")}</span>
        </div>
      </footer>

      {whatsapp && (
        <a className="whatsapp-fab" href={whatsapp} target="_blank" rel="noopener noreferrer" aria-label="Chat on WhatsApp">
          WhatsApp
        </a>
      )}
    </div>
  );
}
