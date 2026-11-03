import { useEffect, useState } from "react";
import { api } from "../api.js";

// Media library: every image, grouped by the section of the site it belongs to.
// Images are stored in Cloudinary under a folder per section (s16/services, s16/about, ...).
export default function MediaLibrary({ token }) {
  const [folders, setFolders] = useState([]);
  const [active, setActive] = useState(""); // "" = all sections
  const [files, setFiles] = useState([]);
  const [uploadTo, setUploadTo] = useState("general");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ type: "", text: "" });

  const loadFolders = () =>
    api("/api/admin/media/folders", { token })
      .then((list) => setFolders(list))
      .catch((e) => setMsg({ type: "error", text: e.message }));

  const loadFiles = () =>
    api(`/api/admin/media${active ? `?folder=${encodeURIComponent(active)}` : ""}`, { token })
      .then(setFiles)
      .catch((e) => setMsg({ type: "error", text: e.message }));

  useEffect(() => {
    loadFolders();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadFiles();
    if (active) setUploadTo(active);
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

  const total = folders.reduce((n, f) => n + f.count, 0);
  const label = (key) => folders.find((f) => f.key === key)?.label || key;

  async function upload(list) {
    setBusy(true);
    setMsg({ type: "", text: "" });
    try {
      for (const file of Array.from(list)) {
        const form = new FormData();
        form.append("file", file);
        form.append("folder", uploadTo);
        await api("/api/admin/media", { method: "POST", token, body: form });
      }
      setMsg({ type: "ok", text: `Uploaded to ${label(uploadTo)}.` });
      loadFiles();
      loadFolders();
    } catch (e) {
      setMsg({ type: "error", text: e.message });
    } finally {
      setBusy(false);
    }
  }

  async function remove(file) {
    if (!window.confirm(`Delete ${file.original_name}? Pages still using this image will show a broken picture.`)) return;
    try {
      await api(`/api/admin/media/${file.id}`, { method: "DELETE", token });
      loadFiles();
      loadFolders();
    } catch (e) {
      setMsg({ type: "error", text: e.message });
    }
  }

  return (
    <div>
      <div className="list-head">
        <h2>Media library</h2>
        <div className="upload-bar">
          <label className="small muted">
            Upload to
            <select value={uploadTo} onChange={(e) => setUploadTo(e.target.value)}>
              {folders.map((f) => (
                <option key={f.key} value={f.key}>{f.label}</option>
              ))}
            </select>
          </label>
          <label className="btn btn-gold btn-sm">
            {busy ? "Uploading…" : "Upload images"}
            <input type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={(e) => upload(e.target.files)} />
          </label>
        </div>
      </div>

      <p className="muted small">Each image is stored in Cloudinary in a folder for its section, so you can find it where it is used.</p>

      <div className="folder-chips" role="tablist" aria-label="Sections">
        <button className={`folder-chip ${active === "" ? "on" : ""}`} onClick={() => setActive("")}>
          All <span>{total}</span>
        </button>
        {folders.map((f) => (
          <button key={f.key} className={`folder-chip ${active === f.key ? "on" : ""}`} onClick={() => setActive(f.key)}>
            {f.label} <span>{f.count}</span>
          </button>
        ))}
      </div>

      {msg.text && <p className={msg.type === "ok" ? "success" : "error"}>{msg.text}</p>}

      <div className="media-grid">
        {files.map((f) => (
          <div key={f.id} className="media-item">
            <img src={f.url} alt={f.original_name} onClick={() => navigator.clipboard?.writeText(f.url)} title="Click to copy the image link" />
            <p className="media-meta">
              <span className="media-tag">{label(f.folder)}</span>
              <span className="muted small">{f.original_name}</span>
            </p>
            <button className="btn btn-sm btn-danger" onClick={() => remove(f)}>Delete</button>
          </div>
        ))}
        {files.length === 0 && <p className="muted">No images here yet. Upload one above.</p>}
      </div>
    </div>
  );
}
