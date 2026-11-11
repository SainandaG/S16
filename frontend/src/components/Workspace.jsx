import { useCallback, useEffect, useState } from "react";
import { api } from "../api.js";
import ProjectTimeline, { STATUS_LABEL, STATUS_ORDER, formatDate } from "./ProjectTimeline.jsx";

// Builds the multipart form the API expects: text fields plus any chosen image files.
function buildForm(fields, files) {
  const form = new FormData();
  Object.entries(fields).forEach(([key, value]) => form.append(key, value));
  files.forEach((file) => form.append("files", file));
  return form;
}

function ImagePicker({ files, onChange }) {
  return (
    <label className="field">
      <span>Reference images (optional, up to 10)</span>
      <input type="file" accept="image/jpeg,image/png,image/gif,image/webp" multiple onChange={(e) => onChange(Array.from(e.target.files || []))} />
      {files.length > 0 && <span className="muted small">{files.length} image(s) selected</span>}
    </label>
  );
}

function NewRequest({ token, onDone, onCancel }) {
  const [title, setTitle] = useState("");
  const [brief, setBrief] = useState("");
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const project = await api("/api/workspace/projects", { method: "POST", token, body: buildForm({ title, brief }, files) });
      onDone(project);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="auth-card ws-form" onSubmit={submit}>
      <h3 className="h-md">Start a new request</h3>
      <p className="muted small">Describe the design you have in mind and add any reference photos. Our team will reply here.</p>
      <label className="field"><span>Project name</span>
        <input required minLength={2} maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Family villa, Jubilee Hills" />
      </label>
      <label className="field"><span>Your brief</span>
        <textarea rows={5} maxLength={4000} value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="Rooms, style, materials, budget and timeline you have in mind" />
      </label>
      <ImagePicker files={files} onChange={setFiles} />
      {error && <p className="error small">{error}</p>}
      <div className="ws-actions">
        <button className="btn btn-solid" disabled={busy}>{busy ? "Sending…" : "Send request"}</button>
        <button type="button" className="btn btn-sm" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

function ProjectDetail({ token, project, onChange }) {
  const [note, setNote] = useState("");
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const current = STATUS_ORDER.indexOf(project.status);

  async function reply(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(`/api/workspace/projects/${project.id}/updates`, { method: "POST", token, body: buildForm({ note }, files) });
      setNote("");
      setFiles([]);
      onChange();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="ws-detail">
      <p className="eyebrow">Requested {formatDate(project.created_at)}</p>
      <h3 className="h-md">{project.title}</h3>
      <ol className="ws-steps" aria-label="Progress">
        {STATUS_ORDER.map((s, i) => (
          <li key={s} className={i < current ? "done" : i === current ? "current" : ""}>{STATUS_LABEL[s]}</li>
        ))}
      </ol>

      <h4 className="ws-subhead">Progress</h4>
      <ProjectTimeline updates={project.updates} />

      <form className="ws-reply" onSubmit={reply}>
        <label className="field"><span>Add a note or images</span>
          <textarea rows={3} maxLength={4000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Share feedback, a new reference or a question" />
        </label>
        <ImagePicker files={files} onChange={setFiles} />
        {error && <p className="error small">{error}</p>}
        <button className="btn btn-solid btn-sm" disabled={busy || (!note.trim() && files.length === 0)}>{busy ? "Sending…" : "Send"}</button>
      </form>
    </article>
  );
}

export default function Workspace({ token }) {
  const [projects, setProjects] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const loadList = useCallback(() => {
    api("/api/workspace/projects", { token }).then(setProjects).catch((e) => setError(e.message));
  }, [token]);

  const loadDetail = useCallback((id) => {
    api(`/api/workspace/projects/${id}`, { token }).then(setDetail).catch((e) => setError(e.message));
  }, [token]);

  useEffect(() => { loadList(); }, [loadList]);
  // open the most recent request by default, so progress is visible straight away
  useEffect(() => {
    if (!creating && openId === null && projects && projects.length > 0) setOpenId(projects[0].id);
  }, [projects, creating, openId]);
  useEffect(() => {
    if (openId === null) setDetail(null);
    else loadDetail(openId);
  }, [openId, loadDetail]);

  function open(id) {
    setCreating(false);
    setOpenId(id);
  }

  return (
    <section className="ws">
      <div className="ws-head">
        <div>
          <p className="eyebrow">Your projects</p>
          <h2 className="h-md">Requests and progress</h2>
        </div>
        {!creating && <button className="btn btn-solid btn-sm" onClick={() => { setCreating(true); setOpenId(null); }}>New request</button>}
      </div>
      {error && <p className="error small">{error}</p>}
      {creating && (
        <NewRequest token={token} onDone={(p) => { setCreating(false); loadList(); setOpenId(p.id); }} onCancel={() => setCreating(false)} />
      )}
      {projects !== null && projects.length === 0 && !creating && (
        <p className="muted">No requests yet. Start one above and our team will follow your progress here.</p>
      )}
      {projects !== null && projects.length > 0 && (
        <div className="ws-layout">
          <ul className="ws-list">
            {projects.map((p) => (
              <li key={p.id}>
                <button className={`ws-item ${openId === p.id ? "on" : ""}`} onClick={() => open(p.id)}>
                  <strong>{p.title}</strong>
                  <span className="muted small">{STATUS_LABEL[p.status] ?? p.status} · {formatDate(p.created_at)}</span>
                </button>
              </li>
            ))}
          </ul>
          {detail && <ProjectDetail token={token} project={detail} onChange={() => loadDetail(detail.id)} />}
        </div>
      )}
    </section>
  );
}
