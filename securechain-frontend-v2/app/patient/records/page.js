"use client";
import { useEffect, useState } from "react";
import PortalShell from "../../../components/PortalShell";
import { VerifyChip, EmptyState, fmtDate } from "../../../components/ui";
import { api } from "../../../lib/api";

const TYPE_LABEL = {
  lab_report: "Lab report",
  consultation_note: "Consultation note",
  imaging: "Imaging",
};

export default function PatientRecords() {
  const [records, setRecords] = useState(null);

  useEffect(() => {
    api.getPatientRecords().then(setRecords);
  }, []);

  return (
    <PortalShell
      role="patient"
      eyebrow="Patient Portal"
      title="Medical records"
      subtitle="Every file is encrypted off-chain; the hash below is what's recorded on-chain for tamper checks."
    >
      <div className="card">
        {records && records.length === 0 && (
          <EmptyState title="No records yet" body="Records appear here once a doctor you've granted access to uploads one." />
        )}
        {records && records.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>Added by</th>
                <th>Date</th>
                <th>Chain verification</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 600 }}>{TYPE_LABEL[r.record_type] || r.record_type}</td>
                  <td>{r.doctor_name}</td>
                  <td style={{ color: "var(--muted)" }}>{fmtDate(r.created_at)}</td>
                  <td><VerifyChip hash={r.record_hash} txId={r.chain_tx_id} stale={!r.verified} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </PortalShell>
  );
}
