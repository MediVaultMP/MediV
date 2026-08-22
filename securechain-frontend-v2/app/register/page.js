"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "../../lib/api";

export default function RegisterPage() {
  const router = useRouter();
  const [role, setRole] = useState("patient");
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "", license_id: "" });
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const needsLicense = role === "doctor" || role === "pharmacy";

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (form.password !== form.confirm) {
      setError("Passwords don't match.");
      return;
    }
    if (!agreed) {
      setError("You need to accept the consent statements to continue.");
      return;
    }
    setLoading(true);
    try {
      await api.register({
        role,
        name: form.name,
        email: form.email,
        password: form.password,
        license_id: needsLicense ? form.license_id : undefined,
      });
      setDone(true);
    } catch (err) {
      // 409 is what the backend should return for a duplicate email;
      // anything else gets an honest message instead of a guessed cause.
      if (err.status === 409) {
        setError("That email is already registered. Try signing in instead.");
      } else {
        setError("Something went wrong creating your account. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="auth-shell">
        <div className="auth-visual">
          <div style={{ fontFamily: "'Fraunces', serif", fontSize: 17 }}>MediVault</div>
          <div />
          <div />
        </div>
        <div className="auth-form-col">
          <div className="auth-card">
            <div className="eyebrow">Almost there</div>
            <h2>
              {needsLicense ? "Your account is pending approval" : "Welcome to MediVault"}
            </h2>
            <p style={{ color: "var(--muted)", fontSize: 13.5, lineHeight: 1.6, marginTop: 10 }}>
              {needsLicense
                ? "An admin will review your license details before your account is activated. You'll be able to sign in once approved."
                : "Your health ID has been generated. You can sign in now to set up your consent wallet."}
            </p>
            <Link href="/login" className="btn btn-primary" style={{ marginTop: 18, display: "inline-flex" }}>
              Go to sign in
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-shell">
      <div className="auth-visual">
        <div style={{ fontFamily: "'Fraunces', serif", fontSize: 17 }}>MediVault</div>

        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", flex: 1 }}>
          <svg width="200" height="200" viewBox="0 0 220 220" fill="none">
            <circle cx="110" cy="110" r="108" stroke="rgba(255,255,255,0.14)" strokeWidth="1.5" />
            <circle cx="110" cy="110" r="82" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5" />
            <circle cx="110" cy="110" r="56" fill="rgba(255,255,255,0.08)" />
            <path d="M110 78v64M78 110h64" stroke="#fff" strokeWidth="6" strokeLinecap="round" />
          </svg>
        </div>

        <div>
          <h1 style={{ color: "#fff", fontSize: 28, lineHeight: 1.3, maxWidth: 380, fontWeight: 500 }}>
            Set up your account in a few steps.
          </h1>
          <p style={{ color: "rgba(255,255,255,0.8)", fontSize: 14, maxWidth: 360, marginTop: 10 }}>
            For patients, providers, and pharmacies alike.
          </p>
        </div>
      </div>

      <div className="auth-form-col">
        <form className="auth-card" onSubmit={handleSubmit}>
          <div className="eyebrow">Create account</div>
          <h2 style={{ margin: "0 0 4px" }}>Get started</h2>
          <p style={{ color: "var(--muted)", fontSize: 13.5, marginBottom: 20 }}>
            Already registered? <Link href="/login" style={{ color: "var(--primary)", fontWeight: 600 }}>Sign in</Link>
          </p>

          <div className="field">
            <label>Account type</label>
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="patient">Patient</option>
              <option value="doctor">Doctor</option>
              <option value="pharmacy">Pharmacy</option>
            </select>
            {needsLicense && (
              <div className="field-hint">Doctor and pharmacy accounts are reviewed by an admin before activation.</div>
            )}
          </div>

          <div className="field">
            <label>Full name</label>
            <input required value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Prapthi Rao" />
          </div>

          <div className="field">
            <label>Email address</label>
            <input type="email" required value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="you@example.com" />
          </div>

          {needsLicense && (
            <div className="field">
              <label>{role === "doctor" ? "Medical license number" : "Pharmacy license number"}</label>
              <input required value={form.license_id} onChange={(e) => set("license_id", e.target.value)} placeholder="MED-2291" />
            </div>
          )}

          <div className="field">
            <label>Password</label>
            <input type="password" required value={form.password} onChange={(e) => set("password", e.target.value)} placeholder="••••••••" />
          </div>
          <div className="field">
            <label>Confirm password</label>
            <input type="password" required value={form.confirm} onChange={(e) => set("confirm", e.target.value)} placeholder="••••••••" />
          </div>

          <label style={{ display: "flex", gap: 9, alignItems: "flex-start", fontSize: 12.5, color: "var(--muted)", marginBottom: 16 }}>
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} style={{ width: "auto", marginTop: 2 }} />
            I agree to the terms of service and privacy policy.
          </label>

          {error && <div className="error-text">{error}</div>}

          <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: "100%", justifyContent: "center", padding: "11px 14px" }}>
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>
      </div>
    </div>
  );
}
