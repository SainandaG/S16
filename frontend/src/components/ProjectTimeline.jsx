// Shared by the customer account page and the admin: the progress timeline of one project.
export const STATUS_LABEL = {
  requested: "Requested",
  concept: "Concept",
  design: "Design",
  approved: "Approved",
  execution: "Execution",
  completed: "Completed",
};

export const STATUS_ORDER = Object.keys(STATUS_LABEL);

export function formatDate(value) {
  return value ? new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "";
}

export default function ProjectTimeline({ updates }) {
  if (!updates || updates.length === 0) {
    return <p className="muted small">No updates yet.</p>;
  }
  return (
    <ol className="tl">
      {updates.map((u) => (
        <li key={u.id} className={`tl-item ${u.author_role === "admin" ? "tl-studio" : "tl-client"}`}>
          <div className="tl-head">
            <strong>{u.author_name}</strong>
            <span className="muted small">
              {formatDate(u.created_at)}
              {u.status && ` · ${STATUS_LABEL[u.status] ?? u.status}`}
            </span>
          </div>
          {u.note && <p className="tl-note">{u.note}</p>}
          {u.images?.length > 0 && (
            <div className="tl-images">
              {u.images.map((img) => (
                <a key={img.url} href={img.url} target="_blank" rel="noopener noreferrer">
                  <img src={img.url} alt="" loading="lazy" />
                </a>
              ))}
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}
