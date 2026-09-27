
// lib/api.js
import { fixtures } from "./fixtures";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/v1";

function authHeaders() {
  if (typeof window === "undefined") return {};
  const token = window.localStorage.getItem("sch_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function normalizeUser(user) {
  const status = user.status || user.approval_status || "active";
  return {
    ...user,
    name: user.name || user.email,
    status,
    approval_status: status,
    health_id: user.health_id || "",
    license_id: user.license_id || "",
    created_at: user.created_at || user.createdAt,
  };
}

function normalizeAuditEvent(event) {
  return {
    ...event,
    actor: event.actor || event.actor_user_id || event.actorUserId || "system",
    action: event.action || event.event_type || event.eventType,
    target:
      event.target ||
      [
        event.resource_type || event.resourceType,
        event.resource_id || event.resourceId,
      ]
        .filter(Boolean)
        .join(" ") ||
      "platform",
    at: event.at || event.created_at || event.createdAt,
  };
}

function normalizeConsent(consent) {
  return {
    ...consent,
    id: consent.id || consent.doctorUserId,
    doctor_name: consent.doctor_name || consent.doctorEmail,
    doctor_email: consent.doctor_email || consent.doctorEmail,
    license_id: consent.license_id || "",
    status: consent.status || "active",
    granted_at: consent.granted_at || consent.createdAt,
    expires_at: consent.expires_at || consent.expiresAt,
  };
}

function normalizeDoctorPatient(patient) {
  return {
    ...patient,
    id: patient.id || patient.patientUserId,
    name: patient.name || patient.patientEmail,
    health_id: patient.health_id || patient.patientUserId,
    records_count: patient.records_count || 0,
    last_visit: patient.last_visit || patient.createdAt,
    granted_at: patient.granted_at || patient.createdAt,
  };
}

async function request(path, { method = "GET", body } = {}) {
  const isFormData =
    typeof FormData !== "undefined" && body instanceof FormData;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: isFormData
      ? authHeaders()
      : { "Content-Type": "application/json", ...authHeaders() },
    body: isFormData ? body : body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = new Error(
      data?.error?.message || `Request failed: ${res.status}`
    );
    err.status = res.status;
    err.code = data?.error?.code;
    err.details = data?.error?.details;
    throw err;
  }

  return data;
}

async function downloadFile(path, filename) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: authHeaders(),
  });

  if (!res.ok) {
    const err = new Error(`Download failed: ${res.status}`);
    err.status = res.status;
    throw err;
  }

  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || "download";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

export const api = {
  // ---------- auth ----------
  // Backend schema: { email, password, role: 'patient'|'doctor'|'pharmacy' }.
  // No name, no license_id, no admin role.
  register: ({ email, password, role }) =>
    request("/auth/register", {
      method: "POST",
      body: { email, password, role },
    }).then((r) => ({ user: r.user, token: r.token })),

  // The backend returns the user's actual role on login.
  login: ({ email, password }) =>
    request("/auth/login", {
      method: "POST",
      body: { email, password },
    }),

  getMe: () => request("/health/me").then((r) => r.user),

  // ---------- patient profile ----------
  getPatientProfile: () =>
    request("/patients/me/profile").then((r) => r.profile ?? r),

  createPatientProfile: (profile) =>
    request("/patients/me/profile", {
      method: "POST",
      body: profile,
    }),

  updatePatientProfile: (profile) =>
    request("/patients/me/profile", {
      method: "PATCH",
      body: profile,
    }),

  // ---------- wallet ----------
  setPatientWallet: (blockchainAddress) =>
    request("/patients/me/wallet", {
      method: "PUT",
      body: { blockchainAddress },
    }),

  setAccountWallet: (blockchainAddress) =>
    request("/account/wallet", {
      method: "PUT",
      body: { blockchainAddress },
    }),

  // ---------- patient: medical records ----------
  // Returned record shape:
  // { id, patientUserId, originalFilename, contentType, sizeBytes,
  //   title, category, blockchainStatus, createdAt }
  getPatientRecords: () =>
    request("/patients/me/records").then((r) => r.records),

  uploadRecord: ({ file, title, category }) => {
    const form = new FormData();
    form.append("document", file);
    if (title) form.append("title", title);
    if (category) form.append("category", category);
    return request("/patients/me/records", {
      method: "POST",
      body: form,
    }).then((r) => r.record);
  },

  verifyRecord: (recordId) =>
    request(`/patients/me/records/${recordId}/verify`, {
      method: "POST",
    }).then((r) => r.verification),

  registerRecordOnChain: (recordId) =>
    request(`/patients/me/records/${recordId}/register-on-chain`, {
      method: "POST",
    }).then((r) => r.record),

  setRecordEmergencyEssential: (recordId, isEmergencyEssential) =>
    request(`/patients/me/records/${recordId}/emergency-essential`, {
      method: "PATCH",
      body: { isEmergencyEssential },
    }).then((r) => r.record),

  downloadOwnRecord: (recordId, filename) =>
    downloadFile(`/patients/me/records/${recordId}/download`, filename),

  // ---------- doctor: patients + records ----------
  // Backend patient shape:
  // { patientUserId, patientEmail, expiresAt, createdAt, updatedAt }
  // Normalization supplies frontend display fields.
  getDoctorPatients: () =>
    request("/doctor/patients").then((r) =>
      r.patients.map(normalizeDoctorPatient)
    ),

  getPatientRecordsForDoctor: (patientId) =>
    request(`/doctor/patients/${patientId}/records`).then((r) => r.records),

  downloadRecordForDoctor: (patientId, recordId, filename) =>
    downloadFile(
      `/doctor/patients/${patientId}/records/${recordId}/download`,
      filename
    ),

  createRecord: ({
    patient_id,
    patientId,
    record_type,
    title,
    category,
    file,
  }) => {
    const form = new FormData();
    form.append("document", file);
    if (title) form.append("title", title);
    if (category || record_type) {
      form.append("category", category || record_type);
    }

    return request(
      `/doctor/patients/${patientId || patient_id}/records`,
      {
        method: "POST",
        body: form,
      }
    ).then((r) => r.record);
  },

  // ---------- consents ----------
  // Patients grant consent directly; no request/approve flow.
  // Returned consent items are already active.
  getConsents: () =>
    request("/consents").then((r) =>
      r.consents.map(normalizeConsent)
    ),

  getPatientConsents: () =>
    request("/consents").then((r) =>
      r.consents.map(normalizeConsent)
    ),

  grantConsent: (doctorId, expiresAt) =>
    request("/consents", {
      method: "POST",
      body: { doctorId, expiresAt },
    }).then((r) => r.consent),

  revokeConsent: (doctorId) =>
    request(`/consents/${doctorId}`, {
      method: "DELETE",
    }).then((r) => r.consent),

  // ---------- prescriptions ----------
  // Prescriptions are signed file uploads verified by hash
  // and doctor wallet signature.
  createPrescription: ({ patientId, title, signature, file }) => {
    const form = new FormData();
    form.append("document", file);
    form.append("patientId", patientId);
    form.append("signature", signature);
    if (title) form.append("title", title);

    return request("/doctor/prescriptions", {
      method: "POST",
      body: form,
    }).then((r) => r.prescription);
  },

  // Returns verification details including signature, content hash,
  // and blockchain validity.
  verifyPrescription: (prescriptionId) =>
    request(`/pharmacy/prescriptions/${prescriptionId}/verify`).then(
      (r) => r.verification
    ),

  // ---------- emergency access (doctor) ----------
  grantEmergencyAccess: ({ patientId, reason, expiresAt }) =>
    request("/emergency-access", {
      method: "POST",
      body: { patientId, reason, expiresAt },
    }),

  getEmergencyEssentialRecords: (patientId) =>
    request(`/emergency-access/patients/${patientId}/records`).then(
      (r) => r.records
    ),

  // ---------- audit (patient) ----------
  getMyAuditLog: () =>
    request("/audit-events/me").then((r) => r.events),

  // ---------- admin ----------
  // These endpoints are marked as not implemented in the backend.
  // Do not wire real network calls to them until implemented.
  getPendingApprovals: () =>
    request("/admin/users/pending").then((r) =>
      r.users.map(normalizeUser)
    ),

  approveUser: (id) =>
    request(`/admin/users/${id}/approve`, {
      method: "POST",
    }).then((r) => normalizeUser(r.user)),

  rejectUser: (id) =>
    request(`/admin/users/${id}/reject`, {
      method: "POST",
    }).then((r) => normalizeUser(r.user)),

  getAllUsers: () =>
    request("/admin/users").then((r) =>
      r.users.map(normalizeUser)
    ),

  getAuditLog: () =>
    request("/admin/audit-events").then((r) =>
      r.events.map(normalizeAuditEvent)
    ),

  getChainLog: () =>
    request("/admin/audit-events").then((r) =>
      r.events
        .filter(
          (event) =>
            event.blockchain_tx_hash || event.blockchainTxHash
        )
        .map((event) => ({
          tx_id: event.blockchain_tx_hash || event.blockchainTxHash,
          action_type: event.event_type || event.eventType,
          payload_hash:
            event.resource_id || event.resourceId || "recorded",
          created_at: event.created_at || event.createdAt,
        }))
    ),

  // ---------- fixture-backed data ----------
  getPatientPrescriptions: async () => fixtures.prescriptions,
  getPharmacyHistory: async () => fixtures.pharmacyHistory,
};