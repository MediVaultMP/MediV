import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { AuthService } from '../src/services/auth-service.js';
import { MedicalRecordService } from '../src/services/medical-record-service.js';
import { FileEncryptionService } from '../src/encryption/file-encryption-service.js';

class MemoryUsers {
  constructor() { this.users = []; }
  async findByEmail(email) { return this.users.find((user) => user.email === email) ?? null; }
  async create({ email, passwordHash, role }) {
    const user = { id: String(this.users.length + 1), email, password_hash: passwordHash, role, created_at: new Date().toISOString() };
    this.users.push(user);
    return { id: user.id, email: user.email, role: user.role, created_at: user.created_at };
  }
}

class MemoryRecords {
  constructor() { this.records = []; }
  async create(input) {
    const record = {
      id: 'd0aa0000-0000-4000-8000-000000000001', patient_user_id: input.patientUserId,
      uploaded_by_user_id: input.uploadedByUserId, storage_key: input.storageKey,
      original_filename: input.originalFilename, content_type: input.contentType, size_bytes: input.sizeBytes,
      title: input.title, category: input.category, content_sha256: input.contentSha256, encryption_algorithm: input.encryption.encryptionAlgorithm,
      encrypted_data_key: input.encryption.encryptedDataKey, data_key_iv: input.encryption.dataKeyIv,
      data_key_auth_tag: input.encryption.dataKeyAuthTag, file_iv: input.encryption.fileIv,
      file_auth_tag: input.encryption.fileAuthTag, created_at: new Date().toISOString()
    };
    this.records.push(record);
    return record;
  }
  async findByIdForPatient(id, patientId) { return this.records.find((record) => record.id === id && record.patient_user_id === patientId) ?? null; }
  async listForPatient(patientId) { return this.records.filter((record) => record.patient_user_id === patientId); }
}

class MemoryStorage {
  constructor() { this.objects = new Map(); }
  async put({ key, body }) { this.objects.set(key, Buffer.from(body)); }
  async get(key) { return this.objects.get(key); }
  async delete(key) { this.objects.delete(key); }
}

function api() {
  const authService = new AuthService({ userRepository: new MemoryUsers(), jwtSecret: 'test-secret-that-is-at-least-thirty-two-characters', jwtExpiresIn: '1h' });
  const medicalRecordService = new MedicalRecordService({
    medicalRecordRepository: new MemoryRecords(),
    medicalStorage: new MemoryStorage(),
    fileEncryptionService: new FileEncryptionService({ masterKey: Buffer.alloc(32, 7) })
  });
  return createApp({ authService, medicalRecordService });
}

async function register(app, role, email) {
  return request(app).post('/api/v1/auth/register').send({ email, password: 'correct-horse-battery', role }).expect(201);
}

describe('medical record API', () => {
  it('uploads, lists, and downloads a patient-owned document', async () => {
    const app = api();
    const patient = await register(app, 'patient', 'patient@example.com');
    const upload = await request(app).post('/api/v1/patients/me/records').set('Authorization', `Bearer ${patient.body.token}`)
      .field('title', 'Blood report').field('category', 'lab-result')
      .attach('document', Buffer.from('%PDF-1.7 test document'), { filename: 'report.pdf', contentType: 'application/pdf' })
      .expect(201);
    expect(upload.body.record).toMatchObject({ originalFilename: 'report.pdf', title: 'Blood report', sizeBytes: 22 });
    expect(upload.body.record).not.toHaveProperty('storageKey');
    const listed = await request(app).get('/api/v1/patients/me/records').set('Authorization', `Bearer ${patient.body.token}`).expect(200);
    expect(listed.body.records).toHaveLength(1);
    await request(app).post(`/api/v1/patients/me/records/${upload.body.record.id}/verify`).set('Authorization', `Bearer ${patient.body.token}`)
      .expect(200, { verification: { recordId: upload.body.record.id, valid: true, localValid: true, blockchainValid: null } });
    const download = await request(app).get(`/api/v1/patients/me/records/${upload.body.record.id}/download`).set('Authorization', `Bearer ${patient.body.token}`).expect(200);
    expect(download.headers['content-disposition']).toContain('report.pdf');
    expect(download.body.toString()).toBe('%PDF-1.7 test document');
  });

  it('rejects upload by a non-patient or unsupported document type', async () => {
    const app = api();
    const doctor = await register(app, 'doctor', 'doctor@example.com');
    await request(app).post('/api/v1/patients/me/records').set('Authorization', `Bearer ${doctor.body.token}`)
      .attach('document', Buffer.from('content'), { filename: 'note.pdf', contentType: 'application/pdf' }).expect(403);
    const patient = await register(app, 'patient', 'patient@example.com');
    await request(app).post('/api/v1/patients/me/records').set('Authorization', `Bearer ${patient.body.token}`)
      .attach('document', Buffer.from('content'), { filename: 'note.exe', contentType: 'application/octet-stream' }).expect(400);
  });
});
