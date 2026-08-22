"use client";
import { useEffect, useState } from "react";
import PortalShell from "../../../components/PortalShell";
import { StatusBadge, EmptyState, fmtDate } from "../../../components/ui";
import { api } from "../../../lib/api";

export default function ConsentWallet() {
  const [consents, setConsents] = useState(null);
  const [busyId, setBusyId] = useState(null);

  function load() {
    api.getPatientConsents().then(setConsents);
  }

  useEffect(load, []);

  async function act(id, action) {
    setBusyId(id);
    try {
      if (action === "grant") await api.grantConsent(id);
      else await api.revokeConsent(id);
      setConsents((cur) => cur.map((c) => (c.id === id ? { ...c, status: action === "grant" ? "active" : "revoked" } : c)));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <PortalShell
      role="patient"
      eyebrow="Patient Portal"
      title="Consent wallet"
      subtitle="Doctors can only view records and issue prescriptions for you while access is active."
    >
      <div className="card">
        {consents && consents.length === 0 && (
          <EmptyState title="No access requests" body="When a doctor requests access, you'll be able to approve it here." />
        )}
        {consents && consents.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>Doctor</th>
                <th>License</th>
                <th>Status</th>
                <th>Granted</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {consents.map((c) => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 600 }}>{c.doctor_name}</td>
                  <td className="mono" style={{ color: "var(--muted)" }}>{c.license_id}</td>
                  <td><StatusBadge status={c.status} /></td>
                  <td style={{ color: "var(--muted)" }}>{fmtDate(c.granted_at)}</td>
                  <td style={{ textAlign: "right" }}>
                    {c.status === "pending" && (
                      <button className="btn btn-primary btn-sm" disabled={busyId === c.id} onClick={() => act(c.id, "grant")}>
                        Grant access
                      </button>
                    )}
                    {c.status === "active" && (
                      <button className="btn btn-danger btn-sm" disabled={busyId === c.id} onClick={() => act(c.id, "revoke")}>
                        Revoke
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </PortalShell>
  );
}
