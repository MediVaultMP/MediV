"use client";
import { useEffect, useState } from "react";
import PortalShell from "../../../components/PortalShell";
import { StatusBadge, EmptyState, fmtDate } from "../../../components/ui";
import { api } from "../../../lib/api";

export default function AccessRequests() {
  const [requests, setRequests] = useState(null);
  const [healthId, setHealthId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function load() {
    api.getDoctorAccessRequests().then(setRequests);
  }

  useEffect(load, []);

  async function handleRequest(e) {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!healthId.trim()) return;
    setSubmitting(true);
    try {
      // Requesting by health ID, not patient name — a doctor never browses
      // a directory of patients, only asks for a specific known ID.
      await api.requestAccess({ patient_health_id: healthId.trim() });
      setSuccess("Request sent. The patient will see it in their consent wallet.");
      setHealthId("");
      load();
    } catch (err) {
      setError("Couldn't send that request. Double check the health ID and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PortalShell
      role="doctor"
      eyebrow="Doctor Portal"
      title="Access requests"
      subtitle="You can only view records or write prescriptions once a patient grants access from their consent wallet."
    >
      <div className="card card-pad" style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 15, margin: "0 0 4px" }}>Request access to a patient</h3>
        <p style={{ color: "var(--muted)", fontSize: 12.5, margin: "0 0 14px" }}>
          Enter the patient's health ID. They'll need to approve the request before you can see anything about them.
        </p>
        <form onSubmit={handleRequest} style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div className="field" style={{ marginBottom: 0, flex: "1 1 240px" }}>
            <label>Patient health ID</label>
            <input value={healthId} onChange={(e) => setHealthId(e.target.value)} placeholder="SCH-4471-9902" />
          </div>
          <button className="btn btn-primary" type="submit" disabled={submitting} style={{ padding: "10px 16px" }}>
            {submitting ? "Sending…" : "Request access"}
          </button>
        </form>
        {error && <div className="error-text">{error}</div>}
        {success && <div style={{ fontSize: 12.5, color: "var(--mint)", marginTop: 8, fontWeight: 600 }}>{success}</div>}
      </div>

      <div className="card">
        {requests && requests.length === 0 && (
          <EmptyState title="No requests yet" body="Requests you send to patients will appear here with their current status." />
        )}
        {requests && requests.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>Patient</th>
                <th>Health ID</th>
                <th>Status</th>
                <th>Requested</th>
                <th>Granted</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 600 }}>{r.patient_name}</td>
                  <td className="mono" style={{ color: "var(--muted)" }}>{r.health_id}</td>
                  <td><StatusBadge status={r.status} /></td>
                  <td style={{ color: "var(--muted)" }}>{fmtDate(r.requested_at)}</td>
                  <td style={{ color: "var(--muted)" }}>{fmtDate(r.granted_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </PortalShell>
  );
}
