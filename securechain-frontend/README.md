# SecureChain Health — Frontend (Patient + Admin portals)

Next.js (App Router) frontend for the two roles fully specified in the project
plan: **Patient** and **Admin**. Doctor and Pharmacy portals aren't built here —
say the word and I'll do those next in the same structure/theme.

## Run it

```bash
npm install
cp .env.local.example .env.local   # point at your Express backend, or leave as-is
npm run dev
```

Open `http://localhost:3000`. If `NEXT_PUBLIC_API_URL` isn't reachable, every
page falls back to the fixtures in `lib/fixtures.js` automatically — the whole
thing is clickable and demoable with zero backend running.

## Structure

```
app/
  login/, register/          — auth (patient/doctor/pharmacy/admin)
  patient/dashboard, records, consents, prescriptions
  admin/dashboard, users, audit-log, chain-log
components/
  PortalShell, Sidebar, ui.jsx (StatCard, StatusBadge, VerifyChip, EmptyState)
lib/
  api.js        — one function per route in the API contract, nothing invented
  fixtures.js   — demo data shaped exactly like the Postgres schema
```

## Design

Light, clinical-but-warm palette (mint/teal/white — no dark surfaces per your
brief). Fraunces for headings (a little warmth/trust), Inter for body copy,
IBM Plex Mono for hashes/tx IDs. The signature element is the **verification
chip** (`.verify-chip` in `globals.css`) — a small pulsing "specimen label"
used on every hashed/signed artifact (records, prescriptions, chain log rows)
so tamper-evidence is legible at a glance instead of a generic checkmark.

## What I deliberately left out (and why)

- **Registration fields**: name, email, password, and license ID for
  doctor/pharmacy only. That's all `users` has columns for. Anything from the
  "patient portal" draft doc that isn't in the schema (DOB, blood group,
  Aadhaar, allergies, insurance, emergency contact, lifestyle) was cut — collecting
  it with nowhere secure to put it is worse than not asking.
- **Guardian recovery / emergency access**: explicitly listed as future work
  in the spec, not built here, not stubbed in the UI either — a visible button
  that does nothing is worse than no button.
- **Admin editing users**: the API contract only has approve/reject, not
  edit/delete. The admin screens don't pretend otherwise.
- **QR codes**: listed as nice-to-have, not required — left out to keep the
  prescription screen honest about what it actually does (share an ID).

## Wiring to the real backend

Nothing here is chain-specific in a way that would break when you move from
the mock `ChainService` to a real Hardhat/Sepolia deployment — the frontend
only ever sees `tx_id` / `payload_hash` strings from `/admin/chain-log`,
`chain_tx_id` on records/prescriptions, etc. Swap `ChainService`'s internals
on the backend and this UI needs no changes.
