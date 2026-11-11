import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { api } from "../api.js";
import { getCustomerToken, setCustomerToken } from "../lib/auth.js";
import { useCustomer } from "../hooks.js";
import Workspace from "../components/Workspace.jsx";

export default function Account() {
  const { customer, loading } = useCustomer();
  const token = getCustomerToken();
  const [profile, setProfile] = useState({ name: "", phone: "" });
  const [enquiries, setEnquiries] = useState([]);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (customer) setProfile({ name: customer.name, phone: customer.phone });
  }, [customer]);

  useEffect(() => {
    if (!token) return;
    api("/api/auth/enquiries", { token }).then(setEnquiries).catch(() => {});
  }, [token]);

  if (loading) return <div className="container section muted">Loading…</div>;
  if (!customer) return <Navigate to="/login" replace state={{ from: "/account" }} />;

  async function saveProfile(e) {
    e.preventDefault();
    setMsg("");
    try {
      await api("/api/auth/me", { method: "PUT", token, body: profile });
      setMsg("Saved.");
    } catch (err) {
      setMsg(err.message);
    }
  }

  return (
    <section className="page-hero">
      <div className="container account-grid">
        <div>
          <p className="eyebrow">Your account</p>
          <h1 className="h-display">Hello, {customer.name.split(" ")[0]}</h1>
          <p className="muted">{customer.email}</p>
          <button className="btn btn-sm" onClick={() => setCustomerToken("")}>Sign out</button>

          <form className="auth-card account-form" onSubmit={saveProfile}>
            <h2 className="h-md">Your details</h2>
            <label className="field"><span>Full name</span>
              <input required minLength={2} value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
            </label>
            <label className="field"><span>Phone</span>
              <input value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
            </label>
            <button className="btn btn-solid">Save details</button>
            {msg && <p className="muted small">{msg}</p>}
          </form>
        </div>

        <div>
          <p className="eyebrow">Your enquiries</p>
          {enquiries.length === 0 ? (
            <p className="muted">You have not sent an enquiry yet. <Link to="/contact" className="link-arrow">Start a project →</Link></p>
          ) : (
            <ul className="enquiry-list">
              {enquiries.map((e) => (
                <li key={e.id}>
                  <strong>{e.project_type || "General enquiry"}</strong>
                  <span className="muted small">{e.created_at ? new Date(e.created_at).toLocaleDateString("en-IN") : ""}</span>
                  {e.message && <p>{e.message}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div className="container ws-wrap">
        <Workspace token={token} />
      </div>
    </section>
  );
}
