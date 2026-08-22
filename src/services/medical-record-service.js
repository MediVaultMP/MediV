import crypto from 'node:crypto';
import path from 'node:path';
import { AppError } from '../utils/app-error.js';

export class MedicalRecordService {
  constructor({ medicalRecordRepository, medicalStorage, fileEncryptionService, userRepository, recordRegistryClient, consentService, auditService }) {
    this.medicalRecordRepository = medicalRecordRepository;
    this.medicalStorage = medicalStorage;
    this.fileEncryptionService = fileEncryptionService;
    this.userRepository = userRepository;
    this.recordRegistryClient = recordRegistryClient;
    this.consentService = consentService;
    this.auditService = auditService;
  }

  async uploadOwnRecord(patientUserId, file, metadata) {
    if (!file) throw new AppError(400, 'A medical document is required.', 'FILE_REQUIRED');
    const storageKey = this.createStorageKey(patientUserId, file.originalname);
    const contentSha256 = this.createSha256(file.buffer);
    const encryption = this.fileEncryptionService.encrypt(file.buffer);
    await this.medicalStorage.put({ key: storageKey, body: encryption.ciphertext, contentType: 'application/octet-stream' });
    try {
      let record = await this.medicalRecordRepository.create({
        patientUserId,
        uploadedByUserId: patientUserId,
        storageKey,
        originalFilename: file.originalname,
        contentType: file.mimetype,
        sizeBytes: file.size,
        title: metadata.title,
        category: metadata.category,
        contentSha256,
        encryption
      });
      if (this.recordRegistryClient) record = await this.registerRecordOnChain(patientUserId, record);
      await this.auditService?.record({ eventType: 'record_created', actorUserId: patientUserId, subjectUserId: patientUserId, resourceType: 'medical_record', resourceId: record.id, metadata: {} });
      return this.publicRecord(record);
    } catch (error) {
      await this.medicalStorage.delete(storageKey).catch(() => {});
      throw error;
    }
  }

  async listOwnRecords(patientUserId) {
    return (await this.medicalRecordRepository.listForPatient(patientUserId)).map((record) => this.publicRecord(record));
  }

  async downloadOwnRecord(patientUserId, recordId) {
    const record = await this.medicalRecordRepository.findByIdForPatient(recordId, patientUserId);
    if (!record) throw new AppError(404, 'Medical record not found.', 'RECORD_NOT_FOUND');
    const ciphertext = await this.medicalStorage.get(record.storage_key);
    const body = this.fileEncryptionService.decrypt(ciphertext, record);
    await this.auditService?.record({ eventType: 'record_accessed', actorUserId: patientUserId, subjectUserId: patientUserId, resourceType: 'medical_record', resourceId: record.id, metadata: {} });
    return { record: this.publicRecord(record), body };
  }

  async listRecordsForDoctor(doctorUserId, patientUserId) {
    await this.consentService.assertDoctorAccess(patientUserId, doctorUserId);
    return (await this.medicalRecordRepository.listForPatient(patientUserId)).map((record) => this.publicRecord(record));
  }

  async downloadRecordForDoctor(doctorUserId, patientUserId, recordId) {
    await this.consentService.assertDoctorAccess(patientUserId, doctorUserId);
    const record = await this.medicalRecordRepository.findByIdForPatient(recordId, patientUserId);
    if (!record) throw new AppError(404, 'Medical record not found.', 'RECORD_NOT_FOUND');
    const ciphertext = await this.medicalStorage.get(record.storage_key);
    const body = this.fileEncryptionService.decrypt(ciphertext, record);
    await this.auditService?.record({ eventType: 'record_accessed', actorUserId: doctorUserId, subjectUserId: patientUserId, resourceType: 'medical_record', resourceId: record.id, metadata: { access: 'consented_doctor' } });
    return { record: this.publicRecord(record), body };
  }

  async setOwnRecordEmergencyEssential(patientUserId, recordId, isEmergencyEssential) {
    const record = await this.medicalRecordRepository.setEmergencyEssential(recordId, patientUserId, isEmergencyEssential);
    if (!record) throw new AppError(404, 'Medical record not found.', 'RECORD_NOT_FOUND');
    await this.auditService?.record({ eventType: 'emergency_record_classification_changed', actorUserId: patientUserId, subjectUserId: patientUserId, resourceType: 'medical_record', resourceId: record.id, metadata: { isEmergencyEssential } });
    return this.publicRecord(record);
  }

  async verifyOwnRecord(patientUserId, recordId) {
    const record = await this.medicalRecordRepository.findByIdForPatient(recordId, patientUserId);
    if (!record) throw new AppError(404, 'Medical record not found.', 'RECORD_NOT_FOUND');
    if (!record.content_sha256) {
      throw new AppError(409, 'This legacy record has no integrity hash. Re-upload it to verify integrity.', 'HASH_UNAVAILABLE');
    }
    try {
      const plaintext = this.fileEncryptionService.decrypt(await this.medicalStorage.get(record.storage_key), record);
      const localValid = this.hashesMatch(this.createSha256(plaintext), record.content_sha256);
      const blockchainValid = record.blockchain_status === 'registered' && this.recordRegistryClient
        ? await this.recordRegistryClient.verifyRecord({ recordId: record.id, contentSha256: record.content_sha256 })
        : null;
      return { recordId: record.id, valid: localValid && blockchainValid !== false, localValid, blockchainValid };
    } catch (error) {
      if (error.code === 'DECRYPTION_FAILED') return { recordId: record.id, valid: false };
      throw error;
    }
  }

  async registerOwnRecordOnChain(patientUserId, recordId) {
    const record = await this.medicalRecordRepository.findByIdForPatient(recordId, patientUserId);
    if (!record) throw new AppError(404, 'Medical record not found.', 'RECORD_NOT_FOUND');
    if (record.blockchain_status === 'registered') return this.publicRecord(record);
    return this.publicRecord(await this.registerRecordOnChain(patientUserId, record));
  }

  async registerRecordOnChain(patientUserId, record) {
    const patient = await this.userRepository.findById(patientUserId);
    if (!patient?.blockchain_address) {
      throw new AppError(409, 'Add a blockchain wallet address before registering records.', 'WALLET_REQUIRED');
    }
    try {
      const registration = await this.recordRegistryClient.registerRecord({
        recordId: record.id,
        contentSha256: record.content_sha256,
        patientAddress: patient.blockchain_address
      });
      return await this.medicalRecordRepository.markBlockchainRegistered(record.id, registration);
    } catch (error) {
      await this.medicalRecordRepository.markBlockchainFailed(record.id);
      throw new AppError(502, 'Blockchain registration failed. Retry the registration after resolving the issue.', 'BLOCKCHAIN_REGISTRATION_FAILED');
    }
  }

  createStorageKey(patientUserId, originalFilename) {
    const extension = path.extname(originalFilename).toLowerCase().replace(/[^.a-z0-9]/g, '').slice(0, 12);
    return `medical-records/${patientUserId}/${crypto.randomUUID()}${extension}`;
  }

  createSha256(buffer) {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  hashesMatch(actual, expected) {
    const actualBuffer = Buffer.from(actual, 'hex');
    const expectedBuffer = Buffer.from(expected, 'hex');
    return actualBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(actualBuffer, expectedBuffer);
  }

  publicRecord(record) {
    return {
      id: record.id,
      patientUserId: record.patient_user_id,
      originalFilename: record.original_filename,
      contentType: record.content_type,
      sizeBytes: record.size_bytes,
      title: record.title,
      category: record.category,
      blockchainStatus: record.blockchain_status,
      createdAt: record.created_at
    };
  }
}
