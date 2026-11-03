import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { api } from "../api.js";

/* ---------- shared pieces ---------- */

// Text input for an image URL, plus an "Upload image" button that fills it in.
export function ImageField({ token, label, value, onChange, folder = "general" }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function upload(file) {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("folder", folder);
      const media = await api("/api/admin/media", { method: "POST", token, body: form });
      onChange(media.url);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="image-field">
      <label>
        {label}
        <input value={value ?? ""} placeholder="https://… or upload an image" onChange={(e) => onChange(e.target.value)} />
      </label>
      <div className="image-actions">
        <label className="btn btn-sm">
          {busy ? "Uploading…" : "Upload image"}
          <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={(e) => upload(e.target.files[0])} />
        </label>
        {value && <img className="thumb" src={value} alt="" />}
      </div>
      {error && <p className="error">{error}</p>}
    </div>
  );
}

// Shows a character count so titles and descriptions stay within search-engine limits.
export function CountedInput({ label, value, onChange, max, multiline = false, rows = 3 }) {
  const len = (value ?? "").length;
  return (
    <label>
      <span className="row-between">
        {label}
        <span className={`small ${len > max ? "error" : "muted"}`}>{len}/{max}</span>
      </span>
      {multiline ? (
        <textarea rows={rows} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
      )}
    </label>
  );
}

/* ---------- SEO defaults (site-wide) ---------- */
const SEO_BLANK = {
  siteName: "", titleSuffix: "", defaultTitle: "", defaultDescription: "", defaultKeywords: "",
  defaultOgImage: "", twitterHandle: "", siteUrl: "",
  organization: { name: "", telephone: "", email: "", city: "", region: "", country: "" },
};

export function SeoPanel({ token }) {
  const [form, setForm] = useState(SEO_BLANK);
  const [msg, setMsg] = useState({ type: "", text: "" });

  useEffect(() => {
    api("/api/admin/settings", { token })
      .then((rows) => {
        const seo = rows.find((r) => r.key === "seo")?.value ?? {};
        setForm({ ...SEO_BLANK, ...seo, organization: { ...SEO_BLANK.organization, ...(seo.organization ?? {}) } });
      })
      .catch((e) => setMsg({ type: "error", text: e.message }));
  }, [token]);

  const set = (key) => (value) => setForm({ ...form, [key]: value });
  const setOrg = (key) => (value) => setForm({ ...form, organization: { ...form.organization, [key]: value } });

  async function save() {
    try {
      await api("/api/admin/settings/seo", { method: "PUT", token, body: { value: form } });
      setMsg({ type: "ok", text: "Saved. Every page uses these defaults unless it has its own SEO values." });
    } catch (e) {
      setMsg({ type: "error", text: e.message });
    }
  }

  return (
    <div className="editor wide-editor">
      <h2>SEO defaults</h2>
      <p className="muted small">Used for any page or post that doesn't set its own SEO values.</p>
      <div className="form-row">
        <CountedInput label="Default title" value={form.defaultTitle} onChange={set("defaultTitle")} max={60} />
        <CountedInput label="Title suffix (added after page titles)" value={form.titleSuffix} onChange={set("titleSuffix")} max={30} />
      </div>
      <CountedInput label="Default meta description" value={form.defaultDescription} onChange={set("defaultDescription")} max={160} multiline rows={3} />
      <CountedInput label="Default keywords (comma-separated)" value={form.defaultKeywords} onChange={set("defaultKeywords")} max={300} multiline rows={2} />
      <div className="form-row">
        <label>Site name<input value={form.siteName} onChange={(e) => set("siteName")(e.target.value)} /></label>
        <label>Public site URL<input value={form.siteUrl} placeholder="https://www.example.com" onChange={(e) => set("siteUrl")(e.target.value)} /></label>
      </div>
      <ImageField token={token} label="Default share image (Open Graph)" value={form.defaultOgImage} onChange={set("defaultOgImage")} folder="seo" />
      <div className="form-row">
        <label>Twitter / X handle<input value={form.twitterHandle} placeholder="@handle" onChange={(e) => set("twitterHandle")(e.target.value)} /></label>
      </div>

      <h3>Business details (structured data for Google)</h3>
      <div className="form-row">
        <label>Business name<input value={form.organization.name} onChange={(e) => setOrg("name")(e.target.value)} /></label>
        <label>Telephone<input value={form.organization.telephone} onChange={(e) => setOrg("telephone")(e.target.value)} /></label>
        <label>Email<input value={form.organization.email} onChange={(e) => setOrg("email")(e.target.value)} /></label>
        <label>City<input value={form.organization.city} onChange={(e) => setOrg("city")(e.target.value)} /></label>
        <label>State / region<input value={form.organization.region} onChange={(e) => setOrg("region")(e.target.value)} /></label>
        <label>Country code<input value={form.organization.country} onChange={(e) => setOrg("country")(e.target.value)} /></label>
      </div>

      <div className="btn-row">
        <button className="btn btn-gold" onClick={save}>Save SEO defaults</button>
      </div>
      {msg.text && <p className={msg.type === "ok" ? "success" : "error"}>{msg.text}</p>}
      <p className="muted small">
        Sitemap and robots.txt are served by the API at <code>/api/sitemap.xml</code> and <code>/api/robots.txt</code>.
        Point <code>/sitemap.xml</code> and <code>/robots.txt</code> on the website domain to those (see the README).
      </p>
    </div>
  );
}

/* ---------- Blog ---------- */
const POST_BLANK = {
  title: "", slug: "", excerpt: "", body: "", cover_image: "", tags: "", status: "draft",
  seo_title: "", seo_description: "", seo_keywords: "", og_image: "", noindex: false,
};

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 160);
}

export function BlogPanel({ token }) {
  const [posts, setPosts] = useState([]);
  const [selected, setSelected] = useState(null); // { id } | { isNew: true }
  const [draft, setDraft] = useState(null);
  const [preview, setPreview] = useState(false);
  const [msg, setMsg] = useState({ type: "", text: "" });

  const load = () => api("/api/admin/blog", { token }).then(setPosts).catch((e) => setMsg({ type: "error", text: e.message }));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function open(post) {
    setSelected(post);
    setDraft({
      ...POST_BLANK,
      ...post,
      tags: (post.tags || []).join(", "),
      noindex: !!post.noindex,
    });
    setPreview(false);
    setMsg({ type: "", text: "" });
  }

  function newPost() {
    setSelected({ isNew: true });
    setDraft({ ...POST_BLANK });
    setPreview(false);
    setMsg({ type: "", text: "" });
  }

  const set = (key) => (value) => {
    setDraft((d) => {
      const next = { ...d, [key]: value };
      // while the post is new and the slug untouched, keep it in step with the title
      if (key === "title" && selected?.isNew && (!d.slug || d.slug === slugify(d.title))) next.slug = slugify(value);
      return next;
    });
  };

  function payload() {
    return {
      title: draft.title,
      slug: draft.slug,
      excerpt: draft.excerpt,
      body: draft.body,
      cover_image: draft.cover_image,
      tags: draft.tags.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean),
      status: draft.status,
      seo_title: draft.seo_title,
      seo_description: draft.seo_description,
      seo_keywords: draft.seo_keywords,
      og_image: draft.og_image,
      noindex: !!draft.noindex,
    };
  }

  async function save() {
    try {
      const saved = selected.isNew
        ? await api("/api/admin/blog", { method: "POST", token, body: payload() })
        : await api(`/api/admin/blog/${selected.id}`, { method: "PUT", token, body: payload() });
      open(saved);
      setMsg({ type: "ok", text: saved.status === "published" ? "Published." : "Saved as draft." });
      load();
    } catch (e) {
      setMsg({ type: "error", text: e.message });
    }
  }

  async function remove() {
    if (!window.confirm(`Delete "${draft.title || "this post"}"?`)) return;
    try {
      await api(`/api/admin/blog/${selected.id}`, { method: "DELETE", token });
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
          <h2>Blog</h2>
          <button className="btn btn-sm" onClick={newPost}>+ New post</button>
        </div>
        {posts.map((p) => (
          <button key={p.id} className={`list-item ${selected?.id === p.id ? "active" : ""}`} onClick={() => open(p)}>
            <strong>{p.title}</strong>
            <span className="muted small">/blog/{p.slug} · {p.status}</span>
          </button>
        ))}
        {posts.length === 0 && <p className="muted small">No posts yet.</p>}
      </div>

      <div className="editor">
        {!draft ? (
          <p className="muted">Select a post or create a new one.</p>
        ) : (
          <>
            <div className="form-row">
              <label>Title<input value={draft.title} onChange={(e) => set("title")(e.target.value)} /></label>
              <label>URL slug<input value={draft.slug} onChange={(e) => set("slug")(e.target.value)} /></label>
            </div>
            <CountedInput label="Excerpt (shown on the journal list)" value={draft.excerpt} onChange={set("excerpt")} max={500} multiline rows={2} />
            <ImageField token={token} label="Cover image" value={draft.cover_image} onChange={set("cover_image")} folder="journal" />
            <div className="form-row">
              <label>Tags (comma-separated)<input value={draft.tags} onChange={(e) => set("tags")(e.target.value)} /></label>
              <label>Status
                <select value={draft.status} onChange={(e) => set("status")(e.target.value)}>
                  <option value="draft">Draft (hidden)</option>
                  <option value="published">Published</option>
                </select>
              </label>
            </div>

            <div className="row-between">
              <span>Body (Markdown)</span>
              <button className="btn btn-sm" onClick={() => setPreview((p) => !p)}>{preview ? "Edit" : "Preview"}</button>
            </div>
            {preview ? (
              <div className="markdown-preview article-body"><ReactMarkdown>{draft.body || "*Nothing written yet.*"}</ReactMarkdown></div>
            ) : (
              <textarea className="code" rows={16} value={draft.body} onChange={(e) => set("body")(e.target.value)} />
            )}

            <h3>Search &amp; sharing</h3>
            <CountedInput label="SEO title (leave blank to use the post title)" value={draft.seo_title} onChange={set("seo_title")} max={60} />
            <CountedInput label="Meta description" value={draft.seo_description} onChange={set("seo_description")} max={160} multiline rows={2} />
            <CountedInput label="Keywords (comma-separated)" value={draft.seo_keywords} onChange={set("seo_keywords")} max={300} />
            <ImageField token={token} label="Share image (leave blank to use the cover)" value={draft.og_image} onChange={set("og_image")} folder="journal" />
            <label className="check"><input type="checkbox" checked={!!draft.noindex} onChange={(e) => set("noindex")(e.target.checked)} /> Hide from search engines</label>

            <div className="btn-row">
              <button className="btn btn-gold" onClick={save}>{draft.status === "published" ? "Save & publish" : "Save draft"}</button>
              {!selected.isNew && <button className="btn btn-danger" onClick={remove}>Delete</button>}
              {!selected.isNew && draft.status === "published" && (
                <a className="btn" href={`/blog/${draft.slug}`} target="_blank" rel="noopener noreferrer">View ↗</a>
              )}
            </div>
            {msg.text && <p className={msg.type === "ok" ? "success" : "error"}>{msg.text}</p>}
          </>
        )}
      </div>
    </div>
  );
}

/* ---------- Services: add, edit, reorder and hide the services shown on the site ---------- */
const SERVICE_BLANK = { title: "", description: "", itemsText: "", image_url: "", sort_order: 0, published: true };

export function ServicesPanel({ token }) {
  const [services, setServices] = useState([]);
  const [selected, setSelected] = useState(null); // { id } | { isNew: true }
  const [draft, setDraft] = useState(null);
  const [msg, setMsg] = useState({ type: "", text: "" });

  const load = () => api("/api/admin/services", { token }).then(setServices).catch((e) => setMsg({ type: "error", text: e.message }));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function open(s) {
    setSelected(s);
    setDraft({ ...SERVICE_BLANK, ...s, itemsText: (s.items || []).join("\n") });
    setMsg({ type: "", text: "" });
  }

  function newService() {
    setSelected({ isNew: true });
    setDraft({ ...SERVICE_BLANK, sort_order: services.length + 1 });
    setMsg({ type: "", text: "" });
  }

  const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));

  function payload() {
    return {
      title: draft.title,
      description: draft.description,
      items: draft.itemsText.split("\n").map((t) => t.trim()).filter(Boolean),
      image_url: draft.image_url,
      sort_order: Number(draft.sort_order) || 0,
      published: !!draft.published,
    };
  }

  async function save() {
    try {
      const saved = selected.isNew
        ? await api("/api/admin/services", { method: "POST", token, body: payload() })
        : await api(`/api/admin/services/${selected.id}`, { method: "PUT", token, body: payload() });
      open(saved);
      setMsg({ type: "ok", text: "Saved. It is live on the website." });
      load();
    } catch (e) {
      setMsg({ type: "error", text: e.message });
    }
  }

  async function remove() {
    if (!window.confirm(`Delete the service "${draft.title}"?`)) return;
    try {
      await api(`/api/admin/services/${selected.id}`, { method: "DELETE", token });
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
          <h2>Services</h2>
          <button className="btn btn-sm" onClick={newService}>+ New service</button>
        </div>
        {services.map((s) => (
          <button key={s.id} className={`list-item ${selected?.id === s.id ? "active" : ""}`} onClick={() => open(s)}>
            <strong>{s.title}</strong>
            <span className="muted small">order {s.sort_order}{s.published ? "" : " · hidden"}</span>
          </button>
        ))}
        {services.length === 0 && <p className="muted small">No services yet.</p>}
      </div>

      <div className="editor">
        {!draft ? (
          <p className="muted">Select a service, or add a new one. Services appear on the Services page and the home page in the order you set.</p>
        ) : (
          <>
            <div className="form-row">
              <label>Title<input value={draft.title} onChange={(e) => set("title")(e.target.value)} /></label>
              <label>Order (lower shows first)<input type="number" value={draft.sort_order} onChange={(e) => set("sort_order")(e.target.value)} /></label>
            </div>
            <CountedInput label="Short description" value={draft.description} onChange={set("description")} max={400} multiline rows={3} />
            <label>
              Points (one per line)
              <textarea rows={7} value={draft.itemsText} onChange={(e) => set("itemsText")(e.target.value)} placeholder={"Architectural design and space planning.\nResidential and villa design."} />
            </label>
            <ImageField token={token} label="Photo" value={draft.image_url} onChange={set("image_url")} folder="services" />
            <label className="check">
              <input type="checkbox" checked={!!draft.published} onChange={(e) => set("published")(e.target.checked)} />
              Show on the website
            </label>

            <div className="btn-row">
              <button className="btn btn-gold" onClick={save}>{selected.isNew ? "Add service" : "Save changes"}</button>
              {!selected.isNew && <button className="btn btn-danger" onClick={remove}>Delete</button>}
            </div>
            {msg.text && <p className={msg.type === "ok" ? "success" : "error"}>{msg.text}</p>}
          </>
        )}
      </div>
    </div>
  );
}

/* ---------- Account: change own password, manage admin accounts ---------- */
export function AccountPanel({ token }) {
  const [me, setMe] = useState("");
  const [admins, setAdmins] = useState([]);
  const [pw, setPw] = useState({ current_password: "", new_password: "", confirm: "" });
  const [newAdmin, setNewAdmin] = useState({ email: "", password: "" });
  const [msg, setMsg] = useState({ type: "", text: "" });

  const load = () => {
    api("/api/admin/me", { token }).then((r) => setMe(r.email)).catch(() => {});
    api("/api/admin/users", { token }).then(setAdmins).catch((e) => setMsg({ type: "error", text: e.message }));
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function changePassword(e) {
    e.preventDefault();
    if (pw.new_password !== pw.confirm) {
      setMsg({ type: "error", text: "The new passwords do not match." });
      return;
    }
    try {
      await api("/api/admin/me/password", { method: "PUT", token, body: { current_password: pw.current_password, new_password: pw.new_password } });
      setPw({ current_password: "", new_password: "", confirm: "" });
      setMsg({ type: "ok", text: "Password changed. Use the new password next time you sign in." });
    } catch (err) {
      setMsg({ type: "error", text: err.message });
    }
  }

  async function addAdmin(e) {
    e.preventDefault();
    try {
      await api("/api/admin/users", { method: "POST", token, body: newAdmin });
      setNewAdmin({ email: "", password: "" });
      setMsg({ type: "ok", text: "Admin account added. They can sign in at /admin with that email and password." });
      load();
    } catch (err) {
      setMsg({ type: "error", text: err.message });
    }
  }

  async function removeAdmin(a) {
    if (!window.confirm(`Remove admin access for ${a.email}?`)) return;
    try {
      await api(`/api/admin/users/${a.id}`, { method: "DELETE", token });
      load();
    } catch (err) {
      setMsg({ type: "error", text: err.message });
    }
  }

  return (
    <div className="split">
      <div className="editor">
        <h2>Your password</h2>
        <p className="muted small">Signed in as {me}</p>
        <form className="form-stack" onSubmit={changePassword}>
          <label>Current password<input type="password" required value={pw.current_password} onChange={(e) => setPw({ ...pw, current_password: e.target.value })} /></label>
          <label>New password (at least 8 characters)<input type="password" required minLength={8} value={pw.new_password} onChange={(e) => setPw({ ...pw, new_password: e.target.value })} /></label>
          <label>Confirm new password<input type="password" required minLength={8} value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} /></label>
          <div className="btn-row"><button className="btn btn-gold">Change password</button></div>
        </form>
      </div>

      <div className="editor">
        <h2>Admin accounts</h2>
        <table className="table">
          <thead><tr><th>Email</th><th /></tr></thead>
          <tbody>
            {admins.map((a) => (
              <tr key={a.id}>
                <td>{a.email}{a.email === me && <span className="muted small"> (you)</span>}</td>
                <td className="actions">
                  {a.email !== me && <button className="btn btn-sm btn-danger" onClick={() => removeAdmin(a)}>Remove</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <h3>Add an admin</h3>
        <form className="form-stack" onSubmit={addAdmin}>
          <label>Email<input type="email" required value={newAdmin.email} onChange={(e) => setNewAdmin({ ...newAdmin, email: e.target.value })} /></label>
          <label>Temporary password (at least 8 characters)<input type="password" required minLength={8} value={newAdmin.password} onChange={(e) => setNewAdmin({ ...newAdmin, password: e.target.value })} /></label>
          <div className="btn-row"><button className="btn btn-gold">Add admin</button></div>
        </form>
        {msg.text && <p className={msg.type === "ok" ? "success" : "error"}>{msg.text}</p>}
      </div>
    </div>
  );
}
