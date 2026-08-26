"use client";
import { useEffect, useState } from "react";
import PortalShell from "../../../components/PortalShell";
import { EmptyState, fmtDate } from "../../../components/ui";
import { api } from "../../../lib/api";

export default function PatientPrescriptions() {
  const [prescriptions, setPrescriptions] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => {
    api.getPatientPrescriptions().then(setPrescriptions);
  }, []);

  function copyId(id) {
    navigator.clipboard.writeText(id).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId((cur) => (cur === id ? null : cur)), 1500);
    });
  }

  return (
    <PortalShell
      role="patient"
      eyebrow="Patient Portal"
      title="Prescriptions"
      subtitle="Share the ID with a pharmacy — they verify the document's signature and chain hash, nothing else about you."
    >
      <div className="card">
        {prescriptions && prescriptions.length === 0 && (
          <EmptyState title="No prescriptions yet" body="Prescriptions a doctor issues you will appear here." />
        )}
        {prescriptions && prescriptions.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>Prescription ID</th>
                <th>Title</th>
                <th>Prescribed by</th>
                <th>Issued</th>
                <th>Chain status</th>
              </tr>
            </thead>
            <tbody>
              {prescriptions.map((p) => (
                <tr key={p.id}>
                  <td className="mono" style={{ fontWeight: 600 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span>{p.id}</span>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => copyId(p.id)}
                        style={{ padding: "2px 8px", fontSize: 11 }}
                      >
                        {copiedId === p.id ? "Copied" : "Copy"}
                      </button>
                    </div>
                  </td>
                  <td>{p.title || "—"}</td>
                  <td style={{ color: "var(--muted)" }}>{p.doctorEmail || "—"}</td>
                  <td style={{ color: "var(--muted)" }}>{fmtDate(p.createdAt)}</td>
                  <td style={{ textTransform: "capitalize" }}>{p.blockchainStatus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </PortalShell>
  );
}