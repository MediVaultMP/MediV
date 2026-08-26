"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import PortalShell from "../../../components/PortalShell";
import { EmptyState, fmtDate } from "../../../components/ui";
import { api } from "../../../lib/api";

export default function DoctorPatients() {
  const [patients, setPatients] = useState(null);

  useEffect(() => {
    api.getDoctorPatients().then(setPatients);
  }, []);

  return (
    <PortalShell
      role="doctor"
      eyebrow="Doctor Portal"
      title="My patients"
      subtitle="Patients who currently have an active consent grant for you. Revoked patients drop off this list immediately."
    >
      <div className="card">
        {patients && patients.length === 0 && (
          <EmptyState title="No patients yet" body="Once a patient grants you access, they'll show up here." />
        )}
        {patients && patients.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>Patient</th>
                <th>Granted</th>
                <th>Expires</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {patients.map((p) => (
                <tr key={p.patientUserId}>
                  <td style={{ fontWeight: 600 }}>{p.patientEmail}</td>
                  <td style={{ color: "var(--muted)" }}>{fmtDate(p.createdAt)}</td>
                  <td style={{ color: "var(--muted)" }}>{fmtDate(p.expiresAt)}</td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <Link href={`/doctor/records/new?patient=${p.patientUserId}`} className="btn btn-ghost btn-sm" style={{ marginRight: 6 }}>
                      Add record
                    </Link>
                    <Link href={`/doctor/prescriptions/new?patient=${p.patientUserId}`} className="btn btn-primary btn-sm">
                      Prescribe
                    </Link>
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