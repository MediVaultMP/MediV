# MediVault backend

Phase 1–6 foundation for MediVault: Express, PostgreSQL, JWT authentication, bcrypt password hashing, patient/doctor/pharmacy role authorization, patient-owned profiles, private AWS S3 medical-document storage, application-level encryption, and SHA-256 integrity verification. Blockchain features are intentionally deferred until later phases.

## Run locally

1. Copy `.env.example` to `.env` and supply a PostgreSQL connection string, a 32+ character JWT secret, AWS region, and an S3 bucket name. Configure AWS credentials through the standard AWS SDK credential-provider chain.
2. Create the `medivault` PostgreSQL database.
3. Run `npm install`, then `npm run db:migrate`.
4. Start the API with `npm run dev`.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/v1/auth/register` | Register a patient, doctor, or pharmacy account |
| POST | `/api/v1/auth/login` | Receive a JWT |
| GET | `/api/v1/health` | Liveness check |
| GET | `/api/v1/health/me` | JWT-protected identity check |
| GET | `/api/v1/patients/me/profile` | Read the authenticated patient's profile |
| POST | `/api/v1/patients/me/profile` | Create the authenticated patient's profile |
| PATCH | `/api/v1/patients/me/profile` | Update the authenticated patient's profile |
| GET | `/api/v1/patients/me/records` | List the authenticated patient's document metadata |
| POST | `/api/v1/patients/me/records` | Upload one medical document (multipart `document` field) |
| GET | `/api/v1/patients/me/records/:recordId/download` | Download the authenticated patient's document |
| POST | `/api/v1/patients/me/records/:recordId/verify` | Verify the document's SHA-256 integrity hash |
| PUT | `/api/v1/patients/me/wallet` | Set the authenticated patient's blockchain wallet address |
| PUT | `/api/v1/account/wallet` | Set any authenticated user's blockchain wallet address |
| POST | `/api/v1/patients/me/records/:recordId/register-on-chain` | Retry blockchain registration for a failed record |
| GET | `/api/v1/consents` | List the authenticated patient's active doctor consents |
| POST | `/api/v1/consents` | Grant a doctor time-bound record access |
| DELETE | `/api/v1/consents/:doctorId` | Revoke a doctor's access |
| GET | `/api/v1/doctor/patients/:patientId/records` | List records when active consent permits |
| GET | `/api/v1/doctor/patients/:patientId/records/:recordId/download` | Download a permitted record |

Registration payload: `{ "email": "user@example.com", "password": "at-least-12-characters", "role": "patient" }`.

Patient profile endpoints are restricted to the authenticated patient. Profile creation requires `firstName`, `lastName`, and `dateOfBirth` (`YYYY-MM-DD`); contact, address, blood type, allergy, and emergency-contact fields are optional.

Medical-document endpoints are currently restricted to the owning patient. They accept PDF, JPEG, and PNG files up to 10 MB. Before upload, each document is encrypted with a newly generated AES-256-GCM data key. The data key is itself encrypted by the base64 32-byte `FILE_ENCRYPTION_KEY` master key and only its encrypted form plus IVs/authentication tags are stored in PostgreSQL. S3 receives ciphertext, uses S3-managed encryption at rest, and is never exposed through an S3 URL. Keep the master key in a secrets manager in production and rotate it using a key-versioned migration process.

Each new document is also hashed with SHA-256 before encryption. The digest is stored in PostgreSQL and is compared against the decrypted document by the verification endpoint. The digest is prepared for blockchain registration in Phase 7, but no medical data or files are placed on-chain.

## Blockchain integrity registry

The Phase 7 Solidity contract lives in [`blockchain/`](blockchain). It registers only opaque record IDs, SHA-256 hashes, patient wallet addresses, and timestamps. It never stores medical documents, filenames, patient profiles, encrypted keys, or clinical data. Phase 8 adds reproducible local and opt-in testnet deployment commands. See [the blockchain README](blockchain/README.md) for contract test and deployment commands.

## Backend blockchain integration

Phase 9 uses `ethers.js` to register each newly uploaded record's SHA-256 hash with the deployed contract. Configure `BLOCKCHAIN_RPC_URL`, `BLOCKCHAIN_CHAIN_ID`, `BLOCKCHAIN_CONTRACT_ADDRESS`, and the dedicated contract-owner `BLOCKCHAIN_PRIVATE_KEY` in `.env`. Before uploading a record, a patient must set their wallet through `PUT /api/v1/patients/me/wallet` with `{ "blockchainAddress": "0x..." }`. A failed registration is retained as `failed` and can be retried with `POST /api/v1/patients/me/records/:recordId/register-on-chain`.

## Consent and doctor access

Phase 10 adds expiry-bound patient consent. A patient grants a doctor by submitting `{ "doctorId": "UUID", "expiresAt": "ISO-8601 timestamp" }` to `POST /api/v1/consents`; both accounts must have wallet addresses. The backend records the consent and mirrors the expiry or revocation to the contract. Doctors receive only the records of patients with an active local consent that also verifies on-chain; expired or revoked consent is denied.

Run automated API tests with `npm test`.
