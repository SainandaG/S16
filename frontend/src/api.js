export const API = (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(/\/$/, "");

// JSON request helper. Pass a FormData as `body` to upload files (the browser sets the type).
export async function api(path, { method = "GET", body, token } = {}) {
  const headers = {};
  let payload;
  if (body instanceof FormData) {
    payload = body;
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API}${path}`, { method, headers, body: payload });
  if (res.status === 204) return null;

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = data?.detail;
    const message = Array.isArray(detail)
      ? detail.map((d) => `${d.loc?.slice(-1)[0] ?? "field"}: ${d.msg}`).join("; ")
      : detail || `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data;
}
