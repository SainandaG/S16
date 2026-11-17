// Content bundled with the site, from backend/seed/site-content.json (copied to content-fallback.json).
// Pages render with it at once, so the layout is in place before the API answers. When the API
// responds, its content replaces this copy. If the text matches, nothing moves on screen.
import content from "../content-fallback.json";

const PAGE_KEYS = { home: "home", about: "about", services: "services", portfolio: "portfolio", process: "process", contact: "contactPage" };

export function fallbackPage(slug) {
  const key = PAGE_KEYS[slug];
  if (!key || !content.pages[key]) return null;
  const seo = content.pageSeo?.[slug] ?? {};
  return { data: content.pages[key], record: { slug, title: slug, ...seo, data: content.pages[key] } };
}

export function fallbackSite() {
  const { site, contact, brand, navigation, footer, seo } = content;
  return { site, contact, brand, navigation, footer, seo };
}

// Lists in the same shape the API returns. Unknown paths return null (no fallback).
export function fallbackList(path) {
  if (path === "/api/projects") {
    return content.projects.map((p, i) => ({
      id: i + 1, title: p.title, category: p.category, location: p.location,
      image_url: p.image, description: p.description, sort_order: i, published: true,
    }));
  }
  if (path === "/api/services") {
    return content.pillars.map((s, i) => ({
      id: i + 1, title: s.title, description: s.description, items: s.items || [],
      image_url: s.image, sort_order: i, published: true,
    }));
  }
  return null;
}
