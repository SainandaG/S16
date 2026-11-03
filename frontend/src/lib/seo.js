import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useSite } from "../hooks.js";

// Creates or updates a <meta> tag. `attr` is "name" or "property".
function setMeta(attr, key, content) {
  if (!content) {
    document.head.querySelector(`meta[${attr}="${key}"]`)?.remove();
    return;
  }
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setCanonical(href) {
  let el = document.head.querySelector('link[rel="canonical"]');
  if (!href) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", "canonical");
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

function setJsonLd(data) {
  let el = document.getElementById("json-ld");
  if (!data) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement("script");
    el.type = "application/ld+json";
    el.id = "json-ld";
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
}

// Writes every head tag for one page. Exported so it can be used outside React if needed.
export function applyHead({ title, description, keywords, image, url, noindex, type, siteName, twitter, jsonLd }) {
  if (title) document.title = title;
  setMeta("name", "description", description);
  setMeta("name", "keywords", keywords);
  setMeta("name", "robots", noindex ? "noindex, nofollow" : "index, follow");
  setMeta("property", "og:title", title);
  setMeta("property", "og:description", description);
  setMeta("property", "og:image", image);
  setMeta("property", "og:url", url);
  setMeta("property", "og:type", type || "website");
  setMeta("property", "og:site_name", siteName);
  setMeta("name", "twitter:card", image ? "summary_large_image" : "summary");
  setMeta("name", "twitter:site", twitter);
  setCanonical(noindex ? "" : url);
  setJsonLd(jsonLd || null);
}

// Schema.org data for the business, shown on the home page.
function organizationLd(seo, base) {
  const org = seo.organization ?? {};
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: org.name || seo.siteName,
    url: base,
    telephone: org.telephone,
    email: org.email,
    address: org.city
      ? { "@type": "PostalAddress", addressLocality: org.city, addressRegion: org.region, addressCountry: org.country }
      : undefined,
  };
}

// Sets the head for a page from its SEO record (the object returned by /api/pages/:slug).
// Falls back to the site-wide defaults from the admin's SEO settings.
export function usePageHead(record, extra = {}) {
  const site = useSite();
  const { pathname } = useLocation();

  useEffect(() => {
    if (!record) return;
    const seo = site?.seo ?? {};
    const base = (seo.siteUrl || window.location.origin).replace(/\/$/, "");
    const isHome = pathname === "/";
    const title =
      record.seo_title ||
      (isHome ? seo.defaultTitle : `${record.title}${seo.titleSuffix ?? ""}`) ||
      document.title;
    applyHead({
      title,
      description: record.meta_description || seo.defaultDescription || "",
      keywords: record.seo_keywords || seo.defaultKeywords || "",
      image: record.og_image || seo.defaultOgImage || "",
      url: record.canonical_url || `${base}${pathname}`,
      noindex: !!record.noindex,
      siteName: seo.siteName,
      twitter: seo.twitterHandle,
      jsonLd: isHome && seo.organization ? organizationLd(seo, base) : null,
      ...extra,
    });
  }, [record, site, pathname, extra.jsonLd, extra.type]); // eslint-disable-line react-hooks/exhaustive-deps
}
