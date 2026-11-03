import { useEffect, useState } from "react";
import { api } from "./api.js";
import { getCustomerToken, setCustomerToken, onAuthChange } from "./lib/auth.js";

// Loads one page. Returns:
//   data   – the page's content blocks (what the page component renders)
//   record – the whole page record, including SEO fields (used by usePageHead)
export function usePage(slug) {
  const [state, setState] = useState({ data: null, record: null, error: null, loading: true });
  useEffect(() => {
    let alive = true;
    setState({ data: null, record: null, error: null, loading: true });
    api(`/api/pages/${slug}`)
      .then((page) => alive && setState({ data: page.data, record: page, error: null, loading: false }))
      .catch((error) => alive && setState({ data: null, record: null, error, loading: false }));
    return () => {
      alive = false;
    };
  }, [slug]);
  return state;
}

// Loads a public API list (e.g. "/api/projects"). Returns { items, error, loading }.
export function useList(path) {
  const [state, setState] = useState({ items: [], error: null, loading: true });
  useEffect(() => {
    let alive = true;
    api(path)
      .then((items) => alive && setState({ items, error: null, loading: false }))
      .catch((error) => alive && setState({ items: [], error, loading: false }));
    return () => {
      alive = false;
    };
  }, [path]);
  return state;
}

// Loads one blog post by slug. Returns { post, error, loading }.
export function useBlogPost(slug) {
  const [state, setState] = useState({ post: null, error: null, loading: true });
  useEffect(() => {
    let alive = true;
    setState({ post: null, error: null, loading: true });
    api(`/api/blog/${slug}`)
      .then((post) => alive && setState({ post, error: null, loading: false }))
      .catch((error) => alive && setState({ post: null, error, loading: false }));
    return () => {
      alive = false;
    };
  }, [slug]);
  return state;
}

// Global site settings (navigation, contact, footer, seo). Null until loaded.
export function useSite() {
  const [site, setSite] = useState(null);
  useEffect(() => {
    api("/api/site").then(setSite).catch(() => setSite({}));
  }, []);
  return site;
}

// The signed-in customer, or null. Updates when the customer signs in or out.
export function useCustomer() {
  const [state, setState] = useState({ customer: null, loading: true });
  useEffect(() => {
    let alive = true;
    const load = () => {
      const token = getCustomerToken();
      if (!token) {
        if (alive) setState({ customer: null, loading: false });
        return;
      }
      api("/api/auth/me", { token })
        .then((customer) => alive && setState({ customer, loading: false }))
        .catch(() => {
          setCustomerToken("");
          if (alive) setState({ customer: null, loading: false });
        });
    };
    load();
    const off = onAuthChange(load);
    return () => {
      alive = false;
      off();
    };
  }, []);
  return state;
}
