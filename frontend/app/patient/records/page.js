"use client";
import { useEffect, useState } from "react";
import PortalShell from "../../../components/PortalShell";
import { EmptyState, fmtDate } from "../../../components/ui";
import { api } from "../../../lib/api";

const CATEGORY_LABEL = {
  "lab-result": "Lab result",
  imaging: "Imaging",
  prescription: "Prescription",
  "clinical-note": "Clinical note",
  other: "Other",
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
      subtitle="Every file is encrypted off-chain; its hash is what's recorded on-chain for tamper checks."
    >
      <div className="card">
        {records && records.length === 0 && (
          <EmptyState title="No records yet" body="Records appear here once you upload one or a doctor you've granted access to adds one." />
        )}
        {records && records.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>Category</th>
                <th>Title</th>
                <th>File</th>
                <th>Date</th>
                <th>Chain status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 600 }}>{CATEGORY_LABEL[r.category] || r.category || "—"}</td>
                  <td>{r.title || "—"}</td>
                  <td style={{ color: "var(--muted)" }}>{r.originalFilename}</td>
                  <td style={{ color: "var(--muted)" }}>{fmtDate(r.createdAt)}</td>
                  <td style={{ textTransform: "capitalize" }}>{r.blockchainStatus}</td>
                  <td style={{ textAlign: "right" }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => api.downloadOwnRecord(r.id, r.originalFilename)}>
                      Download
                    </button>
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