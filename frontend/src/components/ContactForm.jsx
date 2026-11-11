import { useState } from "react";
import { api } from "../api.js";

const EMPTY = { name: "", email: "", phone: "", project_type: "", budget: "", timeline: "", message: "", website: "" };

// Enquiry form. Posts to /api/contact; the honeypot `website` field is hidden from people.
export default function ContactForm({ fields, submitLabel, successText, errorText, heading }) {
  const [form, setForm] = useState(EMPTY);
  const [status, setStatus] = useState({ state: "idle", message: "" });
  const [files, setFiles] = useState([]);
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setStatus({ state: "sending", message: "" });
    const body = new FormData();
    Object.entries(form).forEach(([key, value]) => body.append(key, value));
    files.forEach((file) => body.append("files", file));
    try {
      await api("/api/contact/attachments", { method: "POST", body });
      setStatus({ state: "ok", message: successText });
      setForm(EMPTY);
      setFiles([]);
    } catch (err) {
      setStatus({ state: "error", message: err.message || errorText });
    }
  }

  return (
    <form className="contact-form" onSubmit={submit}>
      <h3 className="form-heading">{heading}</h3>
      <div className="form-grid">
        <label className="field">
          <span>Name</span>
          <input required minLength={2} value={form.name} onChange={set("name")} />
        </label>
        <label className="field">
          <span>Email</span>
          <input type="email" required value={form.email} onChange={set("email")} />
        </label>
        <label className="field">
          <span>Phone</span>
          <input value={form.phone} onChange={set("phone")} />
        </label>
        <label className="field">
          <span>Project type</span>
          <select value={form.project_type} onChange={set("project_type")}>
            <option value="">Select…</option>
            {fields.projectTypes.map((o) => <option key={o}>{o}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Budget</span>
          <select value={form.budget} onChange={set("budget")}>
            <option value="">Select…</option>
            {fields.budgetRanges.map((o) => <option key={o}>{o}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Timeline</span>
          <select value={form.timeline} onChange={set("timeline")}>
            <option value="">Select…</option>
            {fields.timelines.map((o) => <option key={o}>{o}</option>)}
          </select>
        </label>
      </div>
      <label className="field">
        <span>Message</span>
        <textarea
          rows={4}
          value={form.message}
          onChange={set("message")}
          placeholder="Tell us what you do and what you love to have in your home to make extra special..."
        />
      </label>
      <label className="field">
        <span>Photos or plans (optional, up to 10)</span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          multiple
          onChange={(e) => setFiles(Array.from(e.target.files || []).slice(0, 10))}
        />
        <span className="muted small">
          Attach a photo of your space or a sketch to ask whether we can take on this service.
          {files.length > 0 && ` ${files.length} image(s) selected.`}
        </span>
      </label>
      <input type="text" name="website" className="hp" tabIndex={-1} autoComplete="off" aria-hidden="true" value={form.website} onChange={set("website")} />

      <div className="form-actions">
        <button className="btn btn-solid" disabled={status.state === "sending"}>
          {status.state === "sending" ? "Sending…" : submitLabel}
        </button>
        {status.state === "ok" && <p className="success">{status.message}</p>}
        {status.state === "error" && <p className="error">{status.message}</p>}
      </div>
    </form>
  );
}
