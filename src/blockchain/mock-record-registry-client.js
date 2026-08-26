import crypto from 'node:crypto';

// Drop-in replacement for RecordRegistryClient. Same method signatures,
// no RPC, no contract, no wallet funding needed. State lives in memory
// for the life of the process — fine for local dev, not for anything else.
export class MockRecordRegistryClient {
  constructor() {
    this.grants = new Map(); // `${patientAddress}:${doctorAddress}` -> expiresAt (Date)
    this.records = new Map(); // recordId -> { contentSha256, patientAddress, txId, timestamp }
    this.prescriptions = new Map(); // prescriptionId -> { hash, doctorAddress, txId, timestamp }
    console.log('🔷 Mock Blockchain Client initialized');
  }

  deriveRecordId(recordId) {
    return `0xmock${crypto.createHash('sha256').update(String(recordId)).digest('hex').slice(0, 56)}`;
  }

  async registerRecord({ recordId, contentSha256, patientAddress }) {
    console.log(`🔷 Mock: Registering record ${recordId}`);
    const txId = `0xmock${crypto.randomBytes(32).toString('hex')}`;
    this.records.set(recordId, {
      recordId,
      contentSha256,
      patientAddress,
      txId,
      timestamp: new Date().toISOString(),
      status: 'registered'
    });
    return {
      blockchainRecordId: this.deriveRecordId(recordId),
      transactionHash: txId,
      registeredAt: new Date()
    };
  }

  async verifyRecord({ recordId, contentSha256 }) {
    const record = this.records.get(recordId);
    if (!record) return { valid: false, reason: 'Record not found' };
    const valid = record.contentSha256 === contentSha256;
    return { 
      valid, 
      txId: record.txId, 
      timestamp: record.timestamp 
    };
  }

  async grantAccess({ patientAddress, doctorAddress, expiresAt }) {
    console.log(`🔷 Mock: Granting access from ${patientAddress} to ${doctorAddress}`);
    this.grants.set(`${patientAddress}:${doctorAddress}`, expiresAt);
    return `0xmock${crypto.randomBytes(32).toString('hex')}`;
  }

  async revokeAccess({ patientAddress, doctorAddress }) {
    console.log(`🔷 Mock: Revoking access from ${patientAddress} to ${doctorAddress}`);
    this.grants.delete(`${patientAddress}:${doctorAddress}`);
    return `0xmock${crypto.randomBytes(32).toString('hex')}`;
  }

  async hasAccess({ patientAddress, doctorAddress }) {
    const expiresAt = this.grants.get(`${patientAddress}:${doctorAddress}`);
    return !!expiresAt && new Date(expiresAt) > new Date();
  }

  async recordAuditEvent() {
    return `0xmock${crypto.randomBytes(32).toString('hex')}`;
  }

  async grantConsent({ patientId, doctorId, scope }) {
    console.log(`🔷 Mock: Granting consent from ${patientId} to ${doctorId}`);
    const txId = `0xmock${crypto.randomBytes(32).toString('hex')}`;
    return { txId, consentId: `consent_${crypto.randomUUID()}` };
  }

  async revokeConsent({ patientId, doctorId }) {
    console.log(`🔷 Mock: Revoking consent from ${patientId} to ${doctorId}`);
    return { txId: `0xmock${crypto.randomBytes(32).toString('hex')}` };
  }

  async issuePrescription({ prescriptionId, hash, doctorAddress }) {
    console.log(`🔷 Mock: Issuing prescription ${prescriptionId}`);
    const txId = `0xmock${crypto.randomBytes(32).toString('hex')}`;
    this.prescriptions.set(prescriptionId, {
      prescriptionId,
      hash,
      doctorAddress,
      txId,
      timestamp: new Date().toISOString(),
      status: 'valid'
    });
    return { txId };
  }

  async verifyPrescription({ prescriptionId }) {
    const prescription = this.prescriptions.get(prescriptionId);
    if (!prescription) return { valid: false, status: 'not_found' };
    return {
      valid: true,
      status: prescription.status,
      txId: prescription.txId,
      timestamp: prescription.timestamp
    };
  }
}