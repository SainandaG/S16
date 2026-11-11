import { useCallback, useEffect, useState } from "react";
import { api } from "../api.js";
import ProjectTimeline, { STATUS_LABEL, STATUS_ORDER, formatDate } from "../components/ProjectTimeline.jsx";

function AdminProject({ token, project, onPosted }) {
  const [status, setStatus] = useState(project.status);
  const [note, setNote] = useState("");
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => setStatus(project.status), [project.status]);

  async function post(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData();
    form.append("note", note);
    form.append("status", status);
    files.forEach((file) => form.append("files", file));
    try {
      await api(`/api/admin/workspace/projects/${project.id}/updates`, { method: "POST", token, body: form });
      setNote("");
      setFiles([]);
      onPosted();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="row-between">
        <div>
          <p className="adm-crumb">Client project</p>
          <h2>{project.title}</h2>
        </div>
        <span className="muted small">Status: <strong>{STATUS_LABEL[project.status] ?? project.status}</strong></span>
      </div>

      <div className="ws-contact muted small">
        <span><strong>{project.customer_name}</strong></span>
        <span>{project.customer_email}</span>
        {project.customer_phone && <span>{project.customer_phone}</span>}
        <span>Requested {formatDate(project.created_at)}</span>
      </div>

      {project.brief && <p className="ws-brief">{project.brief}</p>}

      <form className="form-stack" onSubmit={post}>
        <h3>Post a progress update</h3>
        <label>Stage
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUS_ORDER.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
        </label>
        <label>Note for the client
          <textarea rows={4} maxLength={4000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What was done, what's next, anything the client should review" />
        </label>
        <label>Progress images (up to 10)
          <input type="file" accept="image/jpeg,image/png,image/gif,image/webp" multiple onChange={(e) => setFiles(Array.from(e.target.files || []))} />
        </label>
        {error && <p className="error">{error}</p>}
        <div className="btn-row">
          <button className="btn btn-gold" disabled={busy}>{busy ? "Posting…" : "Post update"}</button>
        </div>
      </form>

      <h3>Timeline</h3>
      <ProjectTimeline updates={project.updates} />
    </>
  );
}

export default function WorkspacePanel({ token }) {
  const [list, setList] = useState([]);
  const [openId, setOpenId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState("");

  const loadList = useCallback(() => {
    api("/api/admin/workspace/projects", { token }).then(setList).catch((e) => setError(e.message));
  }, [token]);

  const loadDetail = useCallback((id) => {
    api(`/api/admin/workspace/projects/${id}`, { token }).then(setDetail).catch((e) => setError(e.message));
  }, [token]);

  useEffect(() => { loadList(); }, [loadList]);
  useEffect(() => {
    if (openId === null) setDetail(null);
    else loadDetail(openId);
  }, [openId, loadDetail]);

  return (
    <div className="split">
      <div className="list">
        {error && <p className="error small">{error}</p>}
        {list.length === 0 && <p className="muted">No client requests yet.</p>}
        {list.map((p) => (
          <button key={p.id} className={`list-item ${openId === p.id ? "active" : ""}`} onClick={() => setOpenId(p.id)}>
            <strong>{p.title}</strong>
            <span className="muted small">{p.customer_name} · {STATUS_LABEL[p.status] ?? p.status}</span>
          </button>
        ))}
      </div>

      <div className="editor">
        {detail ? (
          <AdminProject token={token} project={detail} onPosted={() => { loadDetail(detail.id); loadList(); }} />
        ) : (
          <p className="muted">Select a client request to see its brief, post progress updates and images, and review the timeline.</p>
        )}
      </div>
    </div>
  );
}
