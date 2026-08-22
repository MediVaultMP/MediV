import { describe, expect, it } from 'vitest';
import { ConsentService } from '../src/services/consent-service.js';

class Consents {
  constructor() { this.items = new Map(); }
  key(patientId, doctorId) { return `${patientId}:${doctorId}`; }
  async grant(input) {
    const item = { patient_user_id: input.patientUserId, doctor_user_id: input.doctorUserId, expires_at: input.expiresAt, revoked_at: null, blockchain_tx_hash: input.transactionHash, created_at: new Date(), updated_at: new Date() };
    this.items.set(this.key(input.patientUserId, input.doctorUserId), item);
    return item;
  }
  async revoke(input) {
    const item = this.items.get(this.key(input.patientUserId, input.doctorUserId));
    if (!item || item.revoked_at) return null;
    item.revoked_at = new Date();
    item.blockchain_tx_hash = input.transactionHash;
    return item;
  }
  async findActive(patientId, doctorId) {
    const item = this.items.get(this.key(patientId, doctorId));
    return item && !item.revoked_at && item.expires_at > new Date() ? item : null;
  }
  async listActiveForPatient(patientId) { return [...this.items.values()].filter((item) => item.patient_user_id === patientId && !item.revoked_at && item.expires_at > new Date()); }
}

const users = {
  patient: { id: 'patient', role: 'patient', email: 'patient@example.com', blockchain_address: '0x1111111111111111111111111111111111111111' },
  doctor: { id: 'doctor', role: 'doctor', email: 'doctor@example.com', blockchain_address: '0x2222222222222222222222222222222222222222' }
};

describe('consent service', () => {
  it('grants on-chain access, authorizes it, and revokes it', async () => {
    const consents = new Consents();
    const access = new Set();
    const client = {
      grantAccess: async ({ patientAddress, doctorAddress }) => { access.add(`${patientAddress}:${doctorAddress}`); return `0x${'a'.repeat(64)}`; },
      revokeAccess: async ({ patientAddress, doctorAddress }) => { access.delete(`${patientAddress}:${doctorAddress}`); return `0x${'b'.repeat(64)}`; },
      hasAccess: async ({ patientAddress, doctorAddress }) => access.has(`${patientAddress}:${doctorAddress}`)
    };
    const service = new ConsentService({
      consentRepository: consents,
      userRepository: { findById: async (id) => users[id] ?? null },
      recordRegistryClient: client
    });
    const consent = await service.grant('patient', 'doctor', new Date(Date.now() + 60_000));
    expect(consent.doctorUserId).toBe('doctor');
    await expect(service.assertDoctorAccess('patient', 'doctor')).resolves.toBeUndefined();
    await service.revoke('patient', 'doctor');
    await expect(service.assertDoctorAccess('patient', 'doctor')).rejects.toMatchObject({ code: 'CONSENT_REQUIRED' });
  });

  it('rejects expired consent before checking the blockchain', async () => {
    const service = new ConsentService({
      consentRepository: { findActive: async () => null },
      userRepository: { findById: async (id) => users[id] },
      recordRegistryClient: { hasAccess: async () => true }
    });
    await expect(service.assertDoctorAccess('patient', 'doctor')).rejects.toMatchObject({ code: 'CONSENT_REQUIRED' });
  });
});
