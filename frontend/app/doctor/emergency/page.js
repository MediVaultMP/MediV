"use client";
import { useEffect, useState } from "react";
import PortalShell from "../../../components/PortalShell";
import { EmptyState, fmtDate } from "../../../components/ui";
import { api } from "../../../lib/api";

const DURATIONS = [15, 30, 45]; // minutes; backend max is 60

export default function EmergencyAccess() {
  const [patientId, setPatientId] = useState("");
  const [reason, setReason] = useState("");
  const [minutes, setMinutes] = useState(30);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [grant, setGrant] = useState(null); // { patientId, expiresAt }
  const [records, setRecords] = useState(null);
  const [left, setLeft] = useState(0); // seconds remaining

  useEffect(() => {
    if (!grant) return;
    const tick = () =>
      setLeft(Math.max(0, Math.floor((new Date(grant.expiresAt) - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [grant]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuid.test(patientId.trim())) return setError("Enter the patient's ID (UUID format).");
    if (reason.trim().length < 10) return setError("Describe the emergency in at least 10 characters.");
    if (!confirmed) return setError("Please confirm this is a genuine emergency.");
    setSubmitting(true);
    try {
      const expiresAt = new Date(Date.now() + minutes * 60 * 1000).toISOString();
      const res = await api.grantEmergencyAccess({
        patientId: patientId.trim(),
        reason: reason.trim(),
        expiresAt,
      });
      setGrant({ patientId: patientId.trim(), expiresAt: res.emergencyAccess?.expiresAt || expiresAt });
      setRecords(await api.getEmergencyEssentialRecords(patientId.trim()));
    } catch (err) {
      if (err.status === 404) setError("No patient found with that ID.");
      else if (err.status === 400) setError("Invalid request. Check the reason and duration.");
      else setError("Couldn't start emergency access. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const active = grant && left > 0;
  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");

  return (
    <PortalShell
      role="doctor"
      eyebrow="Doctor Portal"
      title="Emergency access"
      subtitle="Break-glass access to a patient's emergency-essential records. Time-limited (max 1 hour) and audit-logged."
    >
      <div className="grid grid-2">
        <form className="card card-pad" onSubmit={handleSubmit}>
          <div className="field">
            <label>Patient ID</label>
            <input
              className="mono"
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            />
          </div>
          <div className="field">
            <label>Reason for emergency access</label>
            <textarea
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Unconscious patient in ER, need allergy and medication history"
            />
            <div className="field-hint">Minimum 10 characters. This is stored in the audit log.</div>
          </div>
          <div className="field">
            <label>Access duration</label>
            <select value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
              {DURATIONS.map((m) => (
                <option key={m} value={m}>{m} minutes</option>
              ))}
            </select>
          </div>
          <label style={{ display: "flex", gap: 9, fontSize: 12.5, color: "var(--muted)", marginBottom: 14 }}>
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              style={{ width: "auto" }}
            />
            I confirm this is a genuine medical emergency and understand this access is logged.
          </label>
          {error && <div className="error-text">{error}</div>}
          <button
            className="btn btn-danger"
            type="submit"
            disabled={submitting}
            style={{ width: "100%", justifyContent: "center", padding: "11px 14px", marginTop: 8 }}
          >
            {submitting ? "Requesting…" : "Request emergency access"}
          </button>
        </form>

        <div className="card card-pad">
          {!grant && (
            <EmptyState
              title="No active emergency session"
              body="Records appear here after access is granted."
            />
          )}
          {grant && (
            <>
              <span className={`badge ${active ? "badge-red" : "badge-muted"}`}>
                {active ? `Emergency access active · ${mm}:${ss}` : "Access expired"}
              </span>
              {records && records.length === 0 && (
                <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 14 }}>
                  This patient has no records marked emergency-essential.
                </p>
              )}
              {records && records.length > 0 && active && (
                <table style={{ marginTop: 14 }}>
                  <thead>
                    <tr><th>Title</th><th>Category</th><th>Date</th></tr>
                  </thead>
                  <tbody>
                    {records.map((r) => (
                      <tr key={r.id}>
                        <td style={{ fontWeight: 600 }}>{r.title || r.originalFilename || "—"}</td>
                        <td style={{ color: "var(--muted)" }}>{r.category || "—"}</td>
                        <td style={{ color: "var(--muted)" }}>{fmtDate(r.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {!active && (
                <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 14 }}>
                  Records are hidden. Request access again if still needed.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </PortalShell>
  );
}
