import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { api } from "../api.js";
import { BlogPanel, SeoPanel, ServicesPanel, AccountPanel, ImageField, CountedInput } from "./panels.jsx";

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
    /* storage unavailable: user just logs in again */
  }
}

export default function Admin() {
  const [token, setToken] = useState(loadToken);
  const [tab, setTab] = useState("pages");

  // no separate admin sign-in: admins use the main sign-in page
  if (!token) {
    return <Navigate to="/login" replace state={{ from: "/admin" }} />;
  }

  const tabs = [
    ["pages", "Pages"],
    ["blog", "Blog"],
    ["projects", "Projects"],
    ["services", "Services"],
    ["media", "Media"],
    ["seo", "SEO"],
    ["settings", "Site Settings"],
    ["redirects", "Redirects"],
    ["leads", "Leads"],
    ["account", "Account"],
  ];

  return (
    <div className="admin">
      <aside className="admin-side">
        <strong className="admin-brand">S16 Admin</strong>
        {tabs.map(([key, label]) => (
          <button key={key} className={tab === key ? "active" : ""} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
        <a href="/" className="admin-link">
          View site ↗
        </a>
        <button
          className="logout"
          onClick={() => {
            saveToken("");
            setToken("");
          }}
        >
          Log out
        </button>
      </aside>
      <section className="admin-main">
        {tab === "pages" && <PagesPanel token={token} />}
        {tab === "blog" && <BlogPanel token={token} />}
        {tab === "media" && <MediaPanel token={token} />}
        {tab === "seo" && <SeoPanel token={token} />}
        {tab === "projects" && (
          <CrudPanel
            token={token}
            path="projects"
            title="Projects"
            columns={["title", "category", "location"]}
            fields={[
              { name: "title", label: "Title" },
              { name: "category", label: "Category", type: "select", options: ["Villas", "Interiors", "Commercial"] },
              { name: "location", label: "Location" },
              { name: "image_url", label: "Photo", type: "image", folder: "projects" },
              { name: "description", label: "Description", type: "textarea" },
              { name: "sort_order", label: "Sort order", type: "number" },
              { name: "published", label: "Published", type: "checkbox" },
            ]}
            defaults={{ title: "", category: "Villas", location: "", image_url: "", description: "", sort_order: 0, published: true }}
          />
        )}
        {tab === "services" && <ServicesPanel token={token} />}
        {tab === "settings" && <SettingsPanel token={token} />}
        {tab === "redirects" && (
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
        )}
        {tab === "leads" && <LeadsPanel token={token} />}
        {tab === "account" && <AccountPanel token={token} />}
      </section>
    </div>
  );
}

function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await api("/api/admin/login", { method: "POST", body: { email, password } });
      onLogin(r.access_token);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <form className="card login" onSubmit={submit}>
        <h2>Admin sign in</h2>
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn btn-gold" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}

/* ---------- Pages: edit each page's content blocks as JSON ---------- */
export function PagesPanel({ token }) {
  const [pages, setPages] = useState([]);
  const [selected, setSelected] = useState(null); // page object or {new:true}
  const [draft, setDraft] = useState(null);
  const [msg, setMsg] = useState({ type: "", text: "" });

  const load = () => api("/api/admin/pages", { token }).then(setPages).catch((e) => setMsg({ type: "error", text: e.message }));
  useEffect(() => {
    load();
  }, []);

  function pick(p) {
    setSelected(p);
    setDraft({
      slug: p.slug,
      title: p.title,
      meta_description: p.meta_description,
      published: p.published,
      seo_title: p.seo_title ?? "",
      seo_keywords: p.seo_keywords ?? "",
      og_image: p.og_image ?? "",
      canonical_url: p.canonical_url ?? "",
      noindex: !!p.noindex,
      dataText: JSON.stringify(p.data, null, 2),
    });
    setMsg({ type: "", text: "" });
  }

  function newPage() {
    setSelected({ new: true });
    setDraft({ slug: "", title: "", meta_description: "", published: true, seo_title: "", seo_keywords: "", og_image: "", canonical_url: "", noindex: false, dataText: "{}" });
    setMsg({ type: "", text: "" });
  }

  async function save() {
    let data;
    try {
      data = JSON.parse(draft.dataText);
    } catch (e) {
      setMsg({ type: "error", text: `Content is not valid JSON: ${e.message}` });
      return;
    }
    const body = {
      slug: draft.slug, title: draft.title, meta_description: draft.meta_description, published: draft.published, data,
      seo_title: draft.seo_title, seo_keywords: draft.seo_keywords, og_image: draft.og_image,
      canonical_url: draft.canonical_url, noindex: draft.noindex,
    };
    try {
      if (selected.new) {
        const created = await api("/api/admin/pages", { method: "POST", token, body });
        setSelected(created);
      } else {
        await api(`/api/admin/pages/${selected.id}`, { method: "PUT", token, body });
      }
      setMsg({ type: "ok", text: "Saved." });
      load();
    } catch (e) {
      setMsg({ type: "error", text: e.message });
    }
  }

  async function remove() {
    if (!window.confirm(`Delete page "${selected.slug}"?`)) return;
    try {
      await api(`/api/admin/pages/${selected.id}`, { method: "DELETE", token });
      setSelected(null);
      setDraft(null);
      load();
    } catch (e) {
      setMsg({ type: "error", text: e.message });
    }
  }

  return (
    <div className="split">
      <div className="list">
        <div className="list-head">
          <h2>Pages</h2>
          <button className="btn btn-sm" onClick={newPage}>
            + New
          </button>
        </div>
        {pages.map((p) => (
          <button key={p.id} className={`list-item ${selected?.id === p.id ? "active" : ""}`} onClick={() => pick(p)}>
            <strong>{p.title}</strong>
            <span className="muted small">/{p.slug}{p.published ? "" : " · draft"}</span>
          </button>
        ))}
      </div>
      <div className="editor">
        {!draft ? (
          <p className="muted">Select a page to edit its content.</p>
        ) : (
          <>
            <div className="form-row">
              <label>
                Title
                <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
              </label>
              <label>
                Slug
                <input value={draft.slug} onChange={(e) => setDraft({ ...draft, slug: e.target.value })} />
              </label>
            </div>
            <label className="check">
              <input type="checkbox" checked={draft.published} onChange={(e) => setDraft({ ...draft, published: e.target.checked })} />
              Published
            </label>
            <h3>Search &amp; sharing</h3>
            <CountedInput label="SEO title (blank = page title + site suffix)" value={draft.seo_title} onChange={(v) => setDraft({ ...draft, seo_title: v })} max={60} />
            <CountedInput label="Meta description" value={draft.meta_description} onChange={(v) => setDraft({ ...draft, meta_description: v })} max={160} multiline rows={2} />
            <CountedInput label="Keywords (comma-separated)" value={draft.seo_keywords} onChange={(v) => setDraft({ ...draft, seo_keywords: v })} max={300} />
            <ImageField token={token} label="Share image (Open Graph)" value={draft.og_image} onChange={(v) => setDraft({ ...draft, og_image: v })} folder="pages" />
            <label>Canonical URL (blank = this page's address)<input value={draft.canonical_url} onChange={(e) => setDraft({ ...draft, canonical_url: e.target.value })} /></label>
            <label className="check">
              <input type="checkbox" checked={draft.noindex} onChange={(e) => setDraft({ ...draft, noindex: e.target.checked })} />
              Hide from search engines (noindex)
            </label>
            <label>
              Content blocks (JSON)
              <textarea className="code" rows={24} value={draft.dataText} onChange={(e) => setDraft({ ...draft, dataText: e.target.value })} />
            </label>
            <div className="btn-row">
              <button className="btn btn-gold" onClick={save}>
                Save
              </button>
              {!selected.new && (
                <button className="btn btn-danger" onClick={remove}>
                  Delete
                </button>
              )}
              {!selected.new && (
                <a className="btn" href={`/${selected.slug === "home" ? "" : selected.slug}`} target="_blank" rel="noopener noreferrer">
                  Preview ↗
                </a>
              )}
            </div>
            {msg.text && <p className={msg.type === "ok" ? "success" : "error"}>{msg.text}</p>}
          </>
        )}
      </div>
    </div>
  );
}

/* ---------- Generic list + form for simple tables ---------- */
export function CrudPanel({ token, path, title, columns, fields, defaults }) {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(null); // null = closed, object = editing/new
  const [editId, setEditId] = useState(null);
  const [msg, setMsg] = useState({ type: "", text: "" });

  const load = () => api(`/api/admin/${path}`, { token }).then(setRows).catch((e) => setMsg({ type: "error", text: e.message }));
  useEffect(() => {
    setForm(null);
    load();
  }, [path]);

  function openNew() {
    setEditId(null);
    setForm({ ...defaults });
    setMsg({ type: "", text: "" });
  }

  function openEdit(row) {
    setEditId(row.id);
    const copy = {};
    fields.forEach((f) => (copy[f.name] = row[f.name] ?? defaults[f.name]));
    setForm(copy);
    setMsg({ type: "", text: "" });
  }

  async function save(e) {
    e.preventDefault();
    try {
      const body = { ...form };
      fields.forEach((f) => f.type === "number" && (body[f.name] = Number(body[f.name]) || 0));
      if (editId) await api(`/api/admin/${path}/${editId}`, { method: "PUT", token, body });
      else await api(`/api/admin/${path}`, { method: "POST", token, body });
      setForm(null);
      load();
    } catch (err) {
      setMsg({ type: "error", text: err.message });
    }
  }

  async function remove(row) {
    if (!window.confirm(`Delete this ${title.toLowerCase().replace(/s$/, "")}?`)) return;
    try {
      await api(`/api/admin/${path}/${row.id}`, { method: "DELETE", token });
      load();
    } catch (err) {
      setMsg({ type: "error", text: err.message });
    }
  }

  return (
    <div>
      <div className="list-head">
        <h2>{title}</h2>
        <button className="btn btn-sm btn-gold" onClick={openNew}>
          + New
        </button>
      </div>
      {msg.text && <p className="error">{msg.text}</p>}

      {form && (
        <form className="card form" onSubmit={save}>
          {fields.map((f) =>
            f.type === "image" ? (
              <ImageField
                key={f.name}
                token={token}
                label={f.label}
                folder={f.folder}
                value={form[f.name] ?? ""}
                onChange={(v) => setForm({ ...form, [f.name]: v })}
              />
            ) : (
            <label key={f.name} className={f.type === "checkbox" ? "check" : ""}>
              {f.type === "checkbox" ? (
                <>
                  <input type="checkbox" checked={!!form[f.name]} onChange={(e) => setForm({ ...form, [f.name]: e.target.checked })} />
                  {f.label}
                </>
              ) : (
                <>
                  {f.label}
                  {f.type === "textarea" ? (
                    <textarea rows={3} value={form[f.name] ?? ""} onChange={(e) => setForm({ ...form, [f.name]: e.target.value })} />
                  ) : f.type === "select" ? (
                    <select value={form[f.name]} onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}>
                      {f.options.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={f.type === "number" ? "number" : "text"}
                      value={form[f.name] ?? ""}
                      onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                    />
                  )}
                </>
              )}
            </label>
            )
          )}
          <div className="btn-row">
            <button className="btn btn-gold">{editId ? "Update" : "Create"}</button>
            <button type="button" className="btn" onClick={() => setForm(null)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      <table className="table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c}>{c.replace(/_/g, " ")}</th>
            ))}
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              {columns.map((c) => (
                <td key={c}>{typeof row[c] === "boolean" ? (row[c] ? "Yes" : "No") : String(row[c] ?? "")}</td>
              ))}
              <td className="actions">
                <button className="btn btn-sm" onClick={() => openEdit(row)}>
                  Edit
                </button>
                <button className="btn btn-sm btn-danger" onClick={() => remove(row)}>
                  Delete
                </button>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={columns.length + 1} className="muted">
                No entries yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- Site settings: brand, contact, navigation, footer ---------- */
export function SettingsPanel({ token }) {
  const [rows, setRows] = useState([]);
  const [key, setKey] = useState("");
  const [text, setText] = useState("");
  const [msg, setMsg] = useState({ type: "", text: "" });

  const load = () => api("/api/admin/settings", { token }).then(setRows).catch((e) => setMsg({ type: "error", text: e.message }));
  useEffect(() => {
    load();
  }, []);

  function pick(row) {
    setKey(row.key);
    setText(JSON.stringify(row.value, null, 2));
    setMsg({ type: "", text: "" });
  }

  async function save() {
    try {
      const value = JSON.parse(text);
      await api(`/api/admin/settings/${key}`, { method: "PUT", token, body: { value } });
      setMsg({ type: "ok", text: "Saved. The public site picks this up on next page load." });
      load();
    } catch (e) {
      setMsg({ type: "error", text: e instanceof SyntaxError ? `Invalid JSON: ${e.message}` : e.message });
    }
  }

  return (
    <div className="split">
      <div className="list">
        <div className="list-head">
          <h2>Site settings</h2>
        </div>
        {rows.map((r) => (
          <button key={r.key} className={`list-item ${key === r.key ? "active" : ""}`} onClick={() => pick(r)}>
            <strong>{r.key}</strong>
          </button>
        ))}
      </div>
      <div className="editor">
        {!key ? (
          <p className="muted">Select a settings group (brand, contact, navigation, footer, site).</p>
        ) : (
          <>
            <h3>{key}</h3>
            <textarea className="code" rows={24} value={text} onChange={(e) => setText(e.target.value)} />
            <div className="btn-row">
              <button className="btn btn-gold" onClick={save}>
                Save
              </button>
            </div>
            {msg.text && <p className={msg.type === "ok" ? "success" : "error"}>{msg.text}</p>}
          </>
        )}
      </div>
    </div>
  );
}

/* ---------- Leads (contact form submissions) ---------- */
export function LeadsPanel({ token }) {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const load = () => api("/api/admin/leads", { token }).then(setRows).catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);

  async function remove(id) {
    if (!window.confirm("Delete this enquiry?")) return;
    try {
      await api(`/api/admin/leads/${id}`, { method: "DELETE", token });
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div>
      <h2>Enquiries</h2>
      {error && <p className="error">{error}</p>}
      <table className="table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Name</th>
            <th>Contact</th>
            <th>Project</th>
            <th>Budget / timeline</th>
            <th>Message</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((l) => (
            <tr key={l.id}>
              <td>{l.created_at ? new Date(l.created_at).toLocaleDateString() : ""}</td>
              <td>{l.name}</td>
              <td>
                <a href={`mailto:${l.email}`}>{l.email}</a>
                <br />
                <span className="small">{l.phone}</span>
              </td>
              <td>{l.project_type}</td>
              <td>
                {l.budget}
                <br />
                <span className="small">{l.timeline}</span>
              </td>
              <td className="msg-cell">
                {l.message}
                {l.images?.length > 0 && (
                  <div className="enquiry-images">
                    {l.images.map((img) => (
                      <a key={img.url} href={img.url} target="_blank" rel="noopener noreferrer">
                        <img src={img.url} alt="Attached by the visitor" loading="lazy" />
                      </a>
                    ))}
                  </div>
                )}
              </td>
              <td>
                <button className="btn btn-sm btn-danger" onClick={() => remove(l.id)}>
                  Delete
                </button>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={7} className="muted">
                No enquiries yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
