"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PortalShell from "../../../../components/PortalShell";
import { VerifyChip } from "../../../../components/ui";
import { api } from "../../../../lib/api";

export default function NewPrescription() {
  const router = useRouter();
  const [patients, setPatients] = useState(null);
  const [patientId, setPatientId] = useState("");
  const [medication, setMedication] = useState("");
  const [dosage, setDosage] = useState("");
  const [duration, setDuration] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    api.getDoctorPatients().then((list) => {
      setPatients(list);
      const preset = new URLSearchParams(window.location.search).get("patient");
      if (preset && list.some((p) => p.id === preset)) setPatientId(preset);
      else if (list.length > 0) setPatientId(list[0].id);
    });
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!patientId) {
      setError("Choose a patient you have active access for.");
      return;
    }
    if (!medication.trim() || !dosage.trim()) {
      setError("Medication and dosage are required.");
      return;
    }
    setSubmitting(true);
    try {
      // Backend signs { medication, dosage, duration } with the doctor's
      // ECC private key, hashes the payload, and calls
      // ChainService.issuePrescription — one prescription, one signature,
      // one medication, matching the prescriptions table 1:1.
      const res = await api.createPrescription({
        patient_id: patientId,
        medication: medication.trim(),
        dosage: dosage.trim(),
        duration: duration.trim() || undefined,
        expires_at: expiresAt || undefined,
      });
      setResult(res);
    } catch (err) {
      setError("Couldn't issue this prescription. Confirm you still have active access to this patient.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PortalShell
      role="doctor"
      eyebrow="Doctor Portal"
      title="Write prescription"
      subtitle="Signed with your ECC key on submit. A pharmacy can verify it by ID without seeing anything else about the patient."
    >
      <div className="grid grid-2">
        <form className="card card-pad" onSubmit={handleSubmit}>
          <div className="field">
            <label>Patient</label>
            <select value={patientId} onChange={(e) => setPatientId(e.target.value)} disabled={!patients || patients.length === 0}>
              {patients && patients.length === 0 && <option value="">No patients with active access</option>}
              {patients?.map((p) => (
                <option key={p.id} value={p.id}>{p.name} — {p.health_id}</option>
              ))}
            </select>
            <div className="field-hint">Only patients who've granted you access appear here.</div>
          </div>

          <div className="field">
            <label>Medication</label>
            <input value={medication} onChange={(e) => setMedication(e.target.value)} placeholder="Amoxicillin 500mg" />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="field">
              <label>Dosage</label>
              <input value={dosage} onChange={(e) => setDosage(e.target.value)} placeholder="1 tablet, 3x/day" />
            </div>
            <div className="field">
              <label>Duration (optional)</label>
              <input value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="7 days" />
            </div>
          </div>

          <div className="field">
            <label>Expires on (optional)</label>
            <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
            <div className="field-hint">Leave blank and the pharmacy will see it as open-ended until revoked.</div>
          </div>

          {error && <div className="error-text">{error}</div>}

          <button className="btn btn-primary" type="submit" disabled={submitting} style={{ width: "100%", justifyContent: "center", padding: "11px 14px", marginTop: 6 }}>
            {submitting ? "Signing & issuing…" : "Sign & issue prescription"}
          </button>

          <p style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 10 }}>
            Prescribing more than one medication? Submit this form once per medication — each gets its own signature, hash, and chain record.
          </p>
        </form>

        <div className="card card-pad">
          <h3 style={{ fontSize: 15, margin: "0 0 10px" }}>What happens on submit</h3>
          <ol style={{ margin: 0, paddingLeft: 18, color: "var(--muted)", fontSize: 13, lineHeight: 1.8 }}>
            <li>The prescription is signed with your ECC private key</li>
            <li>A SHA-256 hash of the signed payload is computed</li>
            <li><code className="mono">ChainService.issuePrescription</code> records the hash and returns a tx ID</li>
            <li>An audit log entry (<code className="mono">prescription.issue</code>) is written</li>
          </ol>

          {result && (
            <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 4 }}>Prescription issued</div>
              <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 8 }}>
                Share ID <span className="mono" style={{ color: "var(--ink)", fontWeight: 600 }}>{result.id}</span> with the patient — a pharmacy verifies against this ID alone.
              </div>
              <VerifyChip hash={result.prescription_hash || "pending"} txId={result.chain_tx_id} />
              <button className="btn btn-ghost btn-sm" style={{ display: "block", marginTop: 14 }} onClick={() => router.push("/doctor/patients")}>
                Back to patients
              </button>
            </div>
          )}
        </div>
      </div>
    </PortalShell>
  );
}
