MediVault — Frontend (Patient, Admin, Doctor, Pharmacy)

Next.js (App Router) frontend for all four roles in the project plan:
Patient, Admin, Doctor, and Pharmacy.

Run it
bash
npm install
cp .env.local.example .env.local   # point at your Express backend, or leave as-is
npm run dev

Open http://localhost:3000. If NEXT_PUBLIC_API_URL isn't reachable, every
page falls back to the fixtures in lib/fixtures.js automatically — the whole
thing is clickable and demoable with zero backend running. Use the role
picker on the login screen to sign in as any of the four roles with a demo
account.

Structure
app/
  login/, register/          — auth (patient/doctor/pharmacy/admin)
  patient/dashboard, records, consents, prescriptions
  admin/dashboard, users, audit-log, chain-log
  doctor/dashboard, access-requests, patients, records/new, prescriptions/new
  pharmacy/verify, history
components/
  PortalShell, Sidebar, ui.jsx (StatCard, StatusBadge, VerifyChip, EmptyState)
lib/
  api.js        — one function per route in the API contract, nothing invented
  fixtures.js   — demo data shaped exactly like the Postgres schema
Design

Light, clinical-but-warm palette (mint/teal/white — no dark surfaces per your
brief). Fraunces for headings (a little warmth/trust), Inter for body copy,
IBM Plex Mono for hashes/tx IDs. The signature element is the verification
chip (.verify-chip in globals.css) — a small pulsing "specimen label"
used on every hashed/signed artifact (records, prescriptions, chain log rows)
so tamper-evidence is legible at a glance instead of a generic checkmark.

Doctor portal
Dashboard — active patients, pending requests, records added, and the
logged-in doctor's own license_id (read from session, not hardcoded).
Access requests — request access to a patient by health ID; table of
requests with pending / active / revoked status, matching
consents.status exactly.
My patients — patients with an active consent grant, with quick links
to add a record or write a prescription for each.
Upload record — patient, record type (lab_report /
consultation_note / imaging), and file only. Sent as multipart/form-data
since a File can't go over JSON. No notes field — medical_records has
no column for it.
Write prescription — one medication per submission (medication, dosage,
duration, optional expiry), matching the prescriptions table exactly.
Prescribing several drugs means submitting the form once per drug, each
with its own signature, hash, and chain record.
Pharmacy portal
Verify — look up a prescription by ID; shows only medication, dosage,
duration, prescribing doctor, issue/expiry dates, and validity
(valid / expired / revoked / invalid) — nothing else about the
patient, per the least-privilege requirement.
History — past verifications performed by this pharmacy.
What I deliberately left out (and why)
Registration fields: name, email, password, and license ID for
doctor/pharmacy only. That's all users has columns for. Anything from the
"patient portal" draft doc that isn't in the schema (DOB, blood group,
Aadhaar, allergies, insurance, emergency contact, lifestyle) was cut — collecting
it with nowhere secure to put it is worse than not asking.
Guardian recovery / emergency access: explicitly listed as future work
in the spec, not built here, not stubbed in the UI either — a visible button
that does nothing is worse than no button.
Admin editing users: the API contract only has approve/reject, not
edit/delete. The admin screens don't pretend otherwise.
QR codes: listed as nice-to-have, not required — left out to keep the
prescription screen honest about what it actually does (share an ID).
Multi-medication prescriptions: an earlier draft of this frontend
grouped several medications under one prescription with an items[]
array. The final prescriptions table keeps one medication per row
(medication, dosage, duration as direct columns, no
prescription_items table), so both the doctor's prescription form and
the patient/pharmacy prescription views were reverted to match — one
prescription, one medication, one signature.
Wiring to the real backend

Nothing here is chain-specific in a way that would break when you move from
the mock ChainService to a real Hardhat/Sepolia deployment — the frontend
only ever sees tx_id / payload_hash strings from /admin/chain-log,
chain_tx_id on records/prescriptions, etc. Swap ChainService's internals
on the backend and this UI needs no changes.

Every lib/api.js function maps 1:1 to a route already in the project's API
contract (section 7) — no endpoint used by the doctor or pharmacy portal was
invented. Where the spec doesn't define a dedicated stats endpoint (e.g. no
/doctor/overview or /pharmacy/overview), the dashboard composes its
numbers from the routes that do exist (/doctor/access-requests,
/doctor/patients, /pharmacy/history) instead.
