// lib/api.js
// Thin client for the API contract in the project spec (section 7).
// Every function maps 1:1 to a route. Nothing here invents an endpoint
// that isn't in the contract.
//
// DEMO_MODE: if the backend isn't reachable (e.g. you're just previewing
// the frontend), calls fall back to the fixtures in lib/fixtures.js so
// every screen still renders with realistic data instead of breaking.

import { fixtures } from "./fixtures";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function authHeaders() {
  if (typeof window === "undefined") return {};
  const token = window.localStorage.getItem("sch_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request(path, { method = "GET", body, fallback } = {}) {
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      // FormData sets its own multipart Content-Type (with boundary) — only
      // force JSON headers for plain object bodies.
      headers: isFormData ? authHeaders() : { "Content-Type": "application/json", ...authHeaders() },
      body: isFormData ? body : body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const err = new Error(`Request failed: ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return await res.json();
  } catch (err) {
    // Only fall back when the server never responded (offline, wrong URL,
    // CORS). A real response with an error status — e.g. a genuine 409 on
    // registration — must surface to the user, never get silently replaced
    // with a "success" fixture.
    if (err.status === undefined && fallback !== undefined) {
      console.warn(`[api] ${path} unreachable, using demo fixture`, err.message);
      return fallback;
    }
    throw err;
  }
}

export const api = {
  // -- auth --
  register: (payload) =>
    request("/auth/register", {
      method: "POST",
      body: payload,
      // No backend connected yet -> treat as a successful registration instead
      // of a network failure, so the demo doesn't misreport "email in use".
      fallback: { ok: true, user: fixtures.demoUserFor(payload.role) },
    }),
  login: (payload) =>
    request("/auth/login", {
      method: "POST",
      body: payload,
      fallback: { token: "demo-token", user: fixtures.demoUserFor(payload.role) },
    }),

  // -- patient --
  getPatientOverview: () => request("/patient/overview", { fallback: fixtures.patientOverview }),
  getPatientRecords: () => request("/patient/records", { fallback: fixtures.records }),
  getRecord: (id) => request(`/records/${id}`, { fallback: fixtures.records.find((r) => r.id === id) }),
  getPatientConsents: () => request("/patient/consents", { fallback: fixtures.consents }),
  grantConsent: (id) => request(`/consents/${id}/grant`, { method: "PATCH", fallback: { ok: true } }),
  revokeConsent: (id) => request(`/consents/${id}/revoke`, { method: "PATCH", fallback: { ok: true } }),
  getPatientPrescriptions: () => request("/patient/prescriptions", { fallback: fixtures.prescriptions }),

  // -- doctor --
  // No dedicated /doctor/overview route exists in the contract (section 7),
  // so the doctor dashboard composes its stats from access-requests + patients
  // instead of inventing an endpoint.
  getDoctorAccessRequests: () => request("/doctor/access-requests", { fallback: fixtures.doctorAccessRequests }),
  getDoctorPatients: () => request("/doctor/patients", { fallback: fixtures.doctorPatients }),
  requestAccess: (payload) =>
    request("/consents", { method: "POST", body: payload, fallback: { ok: true, id: `c-${Date.now()}` } }),
  createRecord: ({ patient_id, record_type, file }) => {
    // Sent as multipart since it carries the raw file the backend will
    // encrypt (AES-256-GCM), hash (SHA-256), and route through
    // ChainService.storeRecordHash (section 8) — a JSON body can't carry
    // a File. Fields sent are exactly what medical_records stores directly
    // (patient_id, record_type, file); original_filename, mime_type,
    // file_size_bytes, iv, and auth_tag are all derived server-side from
    // the file itself. There's no notes column, so nothing is collected
    // here that has nowhere to be stored.
    const form = new FormData();
    form.append("patient_id", patient_id);
    form.append("record_type", record_type);
    if (file) form.append("file", file);
    return request("/records", {
      method: "POST",
      body: form,
      fallback: { ok: true, id: `r-${Date.now()}`, chain_tx_id: `0x${Math.random().toString(16).slice(2, 10)}...demo` },
    });
  },
  createPrescription: (payload) =>
    request("/prescriptions", {
      method: "POST",
      body: payload,
      fallback: { ok: true, id: `p-${Date.now()}`, chain_tx_id: `0x${Math.random().toString(16).slice(2, 10)}...demo` },
    }),

  // -- pharmacy --
  // No dedicated /pharmacy/overview route in the contract either — the
  // pharmacy dashboard derives its stats from /pharmacy/history.
  verifyPrescription: (id) =>
    request(`/prescriptions/verify/${id}`, {
      fallback: fixtures.prescriptionLookup[id]
        ? { ...fixtures.prescriptionLookup[id], valid: fixtures.prescriptionLookup[id].status === "valid" }
        : { valid: false, status: "invalid" },
    }),
  getPharmacyHistory: () => request("/pharmacy/history", { fallback: fixtures.pharmacyHistory }),

  // -- admin --
  getPendingApprovals: () => request("/admin/pending-approvals", { fallback: fixtures.pendingApprovals }),
  approveUser: (id) => request(`/admin/users/${id}/approve`, { method: "PATCH", fallback: { ok: true } }),
  rejectUser: (id) => request(`/admin/users/${id}/reject`, { method: "PATCH", fallback: { ok: true } }),
  getAllUsers: () => request("/admin/users", { fallback: fixtures.allUsers }),
  getAuditLog: () => request("/admin/audit-log", { fallback: fixtures.auditLog }),
  getChainLog: () => request("/admin/chain-log", { fallback: fixtures.chainLog }),
};
