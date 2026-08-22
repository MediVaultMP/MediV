"use client";
import { useEffect, useState } from "react";
import PortalShell from "../../../components/PortalShell";
import { StatusBadge, VerifyChip, EmptyState, fmtDate } from "../../../components/ui";
import { api } from "../../../lib/api";

export default function PatientPrescriptions() {
  const [items, setItems] = useState(null);

  useEffect(() => {
    api.getPatientPrescriptions().then(setItems);
  }, []);

  return (
    <PortalShell
      role="patient"
      eyebrow="Patient Portal"
      title="Prescriptions"
      subtitle="Share a prescription ID with a pharmacy — they verify it without seeing the rest of your records."
    >
      <div className="card">
        {items && items.length === 0 && (
          <EmptyState title="No prescriptions yet" body="Prescriptions issued by your doctors will appear here." />
        )}
        {items && items.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>Medication</th>
                <th>Prescribed by</th>
                <th>Issued</th>
                <th>Status</th>
                <th>Chain record</th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{p.medication}</div>
                    <div style={{ color: "var(--muted)", fontSize: 12.5 }}>{p.dosage}</div>
                  </td>
                  <td>{p.doctor_name}</td>
                  <td style={{ color: "var(--muted)" }}>{fmtDate(p.issued_at)}</td>
                  <td><StatusBadge status={p.status} /></td>
                  <td><VerifyChip txId={p.chain_tx_id} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </PortalShell>
  );
}
