"use client";
import { useEffect, useState } from "react";
import PortalShell from "../../../components/PortalShell";
import { StatCard, fmtDateTime } from "../../../components/ui";
import { api } from "../../../lib/api";

const ACTION_LABEL = {
  "record.view": "Record viewed",
  "prescription.issue": "Prescription issued",
  "consent.grant": "Consent granted",
  "consent.revoke": "Consent revoked",
};

export default function PatientDashboard() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.getPatientOverview().then(setData);
  }, []);

  return (
    <PortalShell
      role="patient"
      eyebrow="Patient Portal"
      title={data ? `Welcome back, ${data.name.split(" ")[0]}` : "Welcome back"}
      subtitle={data ? `Health ID ${data.health_id}` : "Loading your overview…"}
    >
      {data && (
        <>
          <div className="grid grid-4" style={{ marginBottom: 20 }}>
            <StatCard label="Doctors with access" value={data.active_consents} icon={<ShieldIcon />} />
            <StatCard label="Medical records" value={data.total_records} icon={<FileIcon />} />
            <StatCard label="Active prescriptions" value={data.active_prescriptions} icon={<PillIcon />} />
            <StatCard label="Health ID" value={<span className="mono" style={{ fontSize: 15 }}>{data.health_id}</span>} icon={<IdIcon />} />
          </div>

          <div className="card card-pad">
            <h3 style={{ fontSize: 15, margin: "0 0 14px" }}>Recent activity</h3>
            <table>
              <tbody>
                {data.recent_activity.map((item, i) => (
                  <tr key={i}>
                    <td style={{ width: 170, color: "var(--muted)", fontSize: 12.5 }}>{fmtDateTime(item.at)}</td>
                    <td style={{ fontWeight: 600 }}>{ACTION_LABEL[item.action] || item.action}</td>
                    <td style={{ color: "var(--muted)" }}>{item.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </PortalShell>
  );
}

function ShieldIcon() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#0E7C7B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l7 3v6c0 4.5-3 8-7 9-4-1-7-4.5-7-9V6l7-3Z" /></svg>;
}
function FileIcon() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#0E7C7B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h9l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" /></svg>;
}
function PillIcon() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#0E7C7B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="9" width="18" height="6" rx="3" /><path d="M12 9v6" /></svg>;
}
function IdIcon() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#0E7C7B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="12" r="2" /><path d="M14 10h4M14 14h4" /></svg>;
}
