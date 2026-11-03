import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { api } from "../api.js";
import { BlogPanel, MediaPanel, SeoPanel, ServicesPanel, AccountPanel } from "./panels.jsx";
import { CrudPanel, PagesPanel, LeadsPanel, SettingsPanel } from "./Admin.jsx";
import "./admin.css";

const TOKEN_KEY = "s16_admin_token";

function loadToken() {
  try {
    return sessionStorage.getItem(TOKEN_KEY) || "";
  } catch {
    return "";
  }
}

function saveToken(t) {
  try {
    if (t) sessionStorage.setItem(TOKEN_KEY, t);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable: the admin signs in again */
  }
}

// Sidebar structure: [key, label, icon]
const NAV = [
  { group: "Overview", items: [["overview", "Dashboard", "⌂"]] },
  {
    group: "Content",
    items: [
      ["pages", "Pages", "▤"],
      ["services", "Services", "✦"],
      ["projects", "Projects", "▦"],
      ["blog", "Journal", "✎"],
      ["media", "Media", "▣"],
    ],
  },
  { group: "Marketing", items: [["seo", "SEO", "⌕"], ["redirects", "Redirects", "↪"]] },
  { group: "Business", items: [["leads", "Enquiries", "✉"]] },
  { group: "System", items: [["settings", "Site settings", "⚙"], ["account", "Account", "◉"]] },
];

// Dashboard: live counts and the latest enquiries. Each card opens its section.
function Overview({ token, go }) {
  const [stats, setStats] = useState(null);
  const [leads, setLeads] = useState([]);

  useEffect(() => {
    Promise.all([
      api("/api/admin/projects", { token }),
      api("/api/admin/services", { token }),
      api("/api/admin/blog", { token }),
      api("/api/admin/leads", { token }),
      api("/api/admin/media", { token }),
      api("/api/admin/pages", { token }),
    ])
      .then(([projects, services, posts, enquiries, media, pages]) => {
        setStats({
          projects: projects.length,
          services: services.length,
          posts: posts.length,
          published: posts.filter((p) => p.status === "published").length,
          leads: enquiries.length,
          media: media.length,
          pages: pages.length,
        });
        setLeads(enquiries.slice(0, 6));
      })
      .catch(() => setStats({}));
  }, [token]);

  const kpi = (label, value, sub, key) => (
    <button className="kpi" onClick={() => go(key)} key={key}>
      <span className="kpi-label">{label}</span>
      <strong>{value ?? "–"}</strong>
      <span className="kpi-sub">{sub}</span>
    </button>
  );

  return (
    <div className="dash">
      <div className="kpis">
        {kpi("Enquiries", stats?.leads, "from the website", "leads")}
        {kpi("Projects", stats?.projects, "in the portfolio", "projects")}
        {kpi("Services", stats?.services, "listed on the site", "services")}
        {kpi("Journal", stats?.posts, `${stats?.published ?? 0} published`, "blog")}
        {kpi("Pages", stats?.pages, "editable pages", "pages")}
        {kpi("Media", stats?.media, "uploaded images", "media")}
      </div>

      <div className="dash-grid">
        <section className="card-panel">
          <div className="panel-head">
            <h2>Recent enquiries</h2>
            <button className="link" onClick={() => go("leads")}>View all →</button>
          </div>
          {leads.length === 0 ? (
            <p className="muted">No enquiries yet.</p>
          ) : (
            <ul className="activity">
              {leads.map((l) => (
                <li key={l.id}>
                  <span className="avatar">{(l.name || "?")[0].toUpperCase()}</span>
                  <div>
                    <strong>{l.name}</strong>
                    <span className="muted small">{l.project_type || "General enquiry"} · {l.email}</span>
                  </div>
                  <time>{l.created_at ? new Date(l.created_at).toLocaleDateString("en-IN") : ""}</time>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card-panel">
          <div className="panel-head">
            <h2>Quick actions</h2>
          </div>
          <div className="actions-list">
            <button className="btn adm-action" onClick={() => go("services")}>Add or edit a service</button>
            <button className="btn adm-action" onClick={() => go("blog")}>Write a journal post</button>
            <button className="btn adm-action" onClick={() => go("media")}>Upload images</button>
            <button className="btn adm-action" onClick={() => go("pages")}>Edit page content</button>
            <button className="btn adm-action" onClick={() => go("seo")}>Update SEO defaults</button>
          </div>
        </section>
      </div>
    </div>
  );
}

export default function AdminApp() {
  const [token, setToken] = useState(loadToken);
  const [tab, setTab] = useState("overview");
  const [email, setEmail] = useState("");

  useEffect(() => {
    if (token) api("/api/admin/me", { token }).then((r) => setEmail(r.email)).catch(() => {});
  }, [token]);

  // no separate admin sign-in: admins use the main sign-in page
  if (!token) {
    return <Navigate to="/login" replace state={{ from: "/admin" }} />;
  }

  const flat = NAV.flatMap((g) => g.items.map(([key, label]) => ({ key, label, group: g.group })));
  const current = flat.find((i) => i.key === tab) || flat[0];

  const content = {
    overview: <Overview token={token} go={setTab} />,
    pages: <PagesPanel token={token} />,
    blog: <BlogPanel token={token} />,
    media: <MediaPanel token={token} />,
    seo: <SeoPanel token={token} />,
    services: <ServicesPanel token={token} />,
    projects: (
      <CrudPanel
        token={token}
        path="projects"
        title="Projects"
        columns={["title", "category", "location"]}
        fields={[
          { name: "title", label: "Title" },
          { name: "category", label: "Category", type: "select", options: ["Villas", "Interiors", "Commercial"] },
          { name: "location", label: "Location" },
          { name: "image_url", label: "Image URL" },
          { name: "description", label: "Description", type: "textarea" },
          { name: "sort_order", label: "Sort order", type: "number" },
          { name: "published", label: "Published", type: "checkbox" },
        ]}
        defaults={{ title: "", category: "Villas", location: "", image_url: "", description: "", sort_order: 0, published: true }}
      />
    ),
    redirects: (
      <CrudPanel
        token={token}
        path="redirects"
        title="Redirects"
        columns={["source_path", "target_url", "status_code", "enabled"]}
        fields={[
          { name: "source_path", label: "From path (e.g. /old-page)" },
          { name: "target_url", label: "To (path or full URL)" },
          { name: "status_code", label: "Status code", type: "select", options: [301, 302, 307, 308] },
          { name: "enabled", label: "Enabled", type: "checkbox" },
        ]}
        defaults={{ source_path: "/", target_url: "/", status_code: 301, enabled: true }}
      />
    ),
    leads: <LeadsPanel token={token} />,
    settings: <SettingsPanel token={token} />,
    account: <AccountPanel token={token} />,
  };

  return (
    <div className="adm">
      <aside className="adm-side">
        <div className="adm-brand">
          <span className="adm-mark">S16</span>
          <span>Admin</span>
        </div>
        {NAV.map((g) => (
          <div key={g.group} className="adm-group">
            <p>{g.group}</p>
            {g.items.map(([key, label, icon]) => (
              <button key={key} className={`adm-link ${tab === key ? "on" : ""}`} onClick={() => setTab(key)}>
                <span className="adm-ico">{icon}</span>
                {label}
              </button>
            ))}
          </div>
        ))}
        <div className="adm-foot">
          <a href="/" target="_blank" rel="noopener noreferrer">View website ↗</a>
          <button
            onClick={() => {
              saveToken("");
              setToken("");
            }}
          >
            Log out
          </button>
        </div>
      </aside>

      <div className="adm-body">
        <header className="adm-top">
          <div>
            <p className="adm-crumb">{current.group}</p>
            <h1>{current.label}</h1>
          </div>
          <div className="adm-user">
            <span className="avatar">{(email || "A")[0].toUpperCase()}</span>
            <span>{email}</span>
          </div>
        </header>
        <main className="adm-main">{content[current.key]}</main>
      </div>
    </div>
  );
}
