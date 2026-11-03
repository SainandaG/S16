export function Loading() {
  return <div className="container section muted">Loading…</div>;
}

export function PageError({ error }) {
  return (
    <div className="container section">
      <p className="error">Could not load this page: {error?.message}</p>
    </div>
  );
}
