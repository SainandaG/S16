import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { api } from "../api.js";

// Unknown path: first check the admin's redirect table, otherwise show a 404.
export default function NotFound() {
  const { pathname, search } = useLocation();
  useEffect(() => {
    api(`/api/resolve?path=${encodeURIComponent(pathname)}`)
      .then((r) => {
        if (r.redirect) window.location.replace(r.redirect.target + search);
      })
      .catch(() => {});
  }, [pathname, search]);
  return (
    <div className="container section">
      <p className="eyebrow">404</p>
      <h1 className="h-display">Page not found</h1>
      <Link to="/" className="link-arrow">Back to home →</Link>
    </div>
  );
}
