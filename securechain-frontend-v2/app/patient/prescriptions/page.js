"use client";
import { useState, useEffect } from "react";
import PortalShell from "../../../components/PortalShell";
import { StatusBadge, VerifyChip, EmptyState, fmtDate } from "../../../components/ui";
import { api } from "../../../lib/api";

export default function PatientPrescriptions() {
  const [prescriptions, setPrescriptions] = useState(null);

  useEffect(() => {
    api.getPatientPrescriptions().then(setPrescriptions);
  }, []);

  return (
    <PortalShell
      role="patient"
      eyebrow="Patient Portal"
      title="Prescriptions"
      subtitle="Each prescription is individually signed — a pharmacy verifies it by ID alone."
    >
      <div className="card">
        {prescriptions && prescriptions.length === 0 && (
          <EmptyState title="No prescriptions yet" body="Prescriptions issued by your doctors will appear here." />
        )}
        {prescriptions && prescriptions.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>Medication</th>
                <th>Dosage</th>
                <th>Duration</th>
                <th>Prescribed by</th>
                <th>Issued</th>
                <th>Status</th>
                <th>Chain verification</th>
              </tr>
            </thead>
            <tbody>
              {prescriptions.map((p) => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 600 }}>{p.medication}</td>
                  <td style={{ color: "var(--muted)" }}>{p.dosage}</td>
                  <td style={{ color: "var(--muted)" }}>{p.duration || "—"}</td>
                  <td>{p.doctor_name}</td>
                  <td style={{ color: "var(--muted)" }}>{fmtDate(p.issued_at)}</td>
                  <td><StatusBadge status={p.status} /></td>
                  <td><VerifyChip hash={p.prescription_hash} txId={p.chain_tx_id} stale={p.status === "revoked"} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </PortalShell>
  );
}
