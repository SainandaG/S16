import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { api } from "../api.js";
import { setCustomerToken } from "../lib/auth.js";

// Password input with an eye button to show or hide the typed password.
function PasswordField({ label, value, onChange, autoComplete, minLength }) {
  const [show, setShow] = useState(false);
  return (
    <label className="field">
      <span>{label}</span>
      <div className="pw-wrap">
        <input
          type={show ? "text" : "password"}
          required
          minLength={minLength}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          className="pw-toggle"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? "Hide password" : "Show password"}
          aria-pressed={show}
          title={show ? "Hide password" : "Show password"}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
            <circle cx="12" cy="12" r="3" />
            {show && <path d="M3 3l18 18" />}
          </svg>
        </button>
      </div>
    </label>
  );
}

// Sign-in and create-account screens for customers. Admins sign in at /admin.
export function SignIn() {
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const next = location.state?.from || "/account";

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await api("/api/auth/login", { method: "POST", body: form });
      if (r.role === "admin") {
        // admin credentials open the admin panel from the same sign-in page
        try {
          sessionStorage.setItem("s16_admin_token", r.access_token);
        } catch {
          /* storage blocked: the admin signs in again after a reload */
        }
        navigate("/admin", { replace: true });
      } else {
        setCustomerToken(r.access_token);
        navigate(next, { replace: true });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="auth-page">
      <form className="auth-card" onSubmit={submit}>
        <img src="/logo.png" alt="S16 Design Studio" className="auth-logo" />
        <p className="eyebrow">Sign in</p>
        <h1 className="h-md">Welcome back</h1>
        <p className="muted small">Customers and the studio team sign in here.</p>
        <label className="field"><span>Email</span>
          <input type="email" required autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </label>
        <PasswordField label="Password" autoComplete="current-password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} />
        {error && <p className="error">{error}</p>}
        <button className="btn btn-solid" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
        <p className="muted small auth-switch">New to S16? <Link to="/register">Create an account</Link></p>
      </form>
    </section>
  );
}

export function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await api("/api/auth/register", { method: "POST", body: form });
      setCustomerToken(r.access_token);
      navigate("/account", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="auth-page">
      <form className="auth-card" onSubmit={submit}>
        <img src="/logo.png" alt="S16 Design Studio" className="auth-logo" />
        <p className="eyebrow">Create your account</p>
        <h1 className="h-md">Track your enquiries and projects</h1>
        <label className="field"><span>Full name</span>
          <input required minLength={2} autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </label>
        <label className="field"><span>Email</span>
          <input type="email" required autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </label>
        <label className="field"><span>Phone (optional)</span>
          <input type="tel" autoComplete="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </label>
        <PasswordField label="Password (at least 8 characters)" minLength={8} autoComplete="new-password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} />
        {error && <p className="error">{error}</p>}
        <button className="btn btn-solid" disabled={busy}>{busy ? "Creating account…" : "Create account"}</button>
        <p className="muted small auth-switch">Already have an account? <Link to="/login">Sign in</Link></p>
      </form>
    </section>
  );
}
