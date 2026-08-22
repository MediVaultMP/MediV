import crypto from 'node:crypto';
import path from 'node:path';
import { getAddress, getBytes, verifyMessage } from 'ethers';
import { AppError } from '../utils/app-error.js';

export class PrescriptionService {
  constructor({ prescriptionRepository, medicalStorage, fileEncryptionService, userRepository, consentService, recordRegistryClient }) {
    this.prescriptionRepository = prescriptionRepository;
    this.medicalStorage = medicalStorage;
    this.fileEncryptionService = fileEncryptionService;
    this.userRepository = userRepository;
    this.consentService = consentService;
    this.recordRegistryClient = recordRegistryClient;
  }

  async create(doctorUserId, patientUserId, file, { title, signature }) {
    if (!file) throw new AppError(400, 'A prescription document is required.', 'FILE_REQUIRED');
    await this.consentService.assertDoctorAccess(patientUserId, doctorUserId);
    const doctor = await this.userRepository.findById(doctorUserId);
    const contentSha256 = this.createSha256(file.buffer);
    if (!this.isDoctorSignatureValid(contentSha256, signature, doctor.blockchain_address)) {
      throw new AppError(400, 'Prescription signature does not match the doctor wallet.', 'INVALID_PRESCRIPTION_SIGNATURE');
    }
    const storageKey = this.createStorageKey(patientUserId, file.originalname);
    const encryption = this.fileEncryptionService.encrypt(file.buffer);
    await this.medicalStorage.put({ key: storageKey, body: encryption.ciphertext, contentType: 'application/octet-stream' });
    try {
      let prescription = await this.prescriptionRepository.create({
        patientUserId, doctorUserId, storageKey, originalFilename: file.originalname, contentType: file.mimetype,
        sizeBytes: file.size, title, contentSha256, doctorSignature: signature, encryption
      });
      prescription = await this.registerOnChain(prescription);
      return this.publicPrescription(prescription);
    } catch (error) {
      await this.medicalStorage.delete(storageKey).catch(() => {});
      throw error;
    }
  }

  async verifyForPharmacy(prescriptionId) {
    const prescription = await this.prescriptionRepository.findById(prescriptionId);
    if (!prescription) throw new AppError(404, 'Prescription not found.', 'PRESCRIPTION_NOT_FOUND');
    const doctor = await this.userRepository.findById(prescription.doctor_user_id);
    const signatureValid = this.isDoctorSignatureValid(prescription.content_sha256, prescription.doctor_signature, doctor?.blockchain_address);
    let contentHashValid = false;
    try {
      const plaintext = this.fileEncryptionService.decrypt(await this.medicalStorage.get(prescription.storage_key), prescription);
      contentHashValid = this.hashesMatch(this.createSha256(plaintext), prescription.content_sha256);
    } catch { /* Integrity failure is reported without exposing storage/encryption details. */ }
    let blockchainValid = false;
    if (prescription.blockchain_status === 'registered') {
      try { blockchainValid = await this.recordRegistryClient.verifyRecord({ recordId: prescription.id, contentSha256: prescription.content_sha256 }); } catch { blockchainValid = false; }
    }
    return {
      prescriptionId: prescription.id,
      doctorUserId: prescription.doctor_user_id,
      issuedAt: prescription.created_at,
      valid: signatureValid && contentHashValid && blockchainValid,
      signatureValid,
      contentHashValid,
      blockchainValid
    };
  }

  async registerOnChain(prescription) {
    const patient = await this.userRepository.findById(prescription.patient_user_id);
    try {
      const registration = await this.recordRegistryClient.registerRecord({
        recordId: prescription.id, contentSha256: prescription.content_sha256, patientAddress: patient.blockchain_address
      });
      return await this.prescriptionRepository.markBlockchainRegistered(prescription.id, registration);
    } catch {
      await this.prescriptionRepository.markBlockchainFailed(prescription.id);
      throw new AppError(502, 'Prescription blockchain registration failed.', 'BLOCKCHAIN_REGISTRATION_FAILED');
    }
  }

  isDoctorSignatureValid(contentSha256, signature, doctorAddress) {
    try { return !!doctorAddress && getAddress(verifyMessage(getBytes(`0x${contentSha256}`), signature)) === getAddress(doctorAddress); } catch { return false; }
  }

  createSha256(buffer) { return crypto.createHash('sha256').update(buffer).digest('hex'); }
  hashesMatch(actual, expected) { return crypto.timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(expected, 'hex')); }
  createStorageKey(patientId, filename) {
    const extension = path.extname(filename).toLowerCase().replace(/[^.a-z0-9]/g, '').slice(0, 12);
    return `prescriptions/${patientId}/${crypto.randomUUID()}${extension}`;
  }

  publicPrescription(prescription) {
    return {
      id: prescription.id, patientUserId: prescription.patient_user_id, doctorUserId: prescription.doctor_user_id,
      originalFilename: prescription.original_filename, contentType: prescription.content_type, sizeBytes: prescription.size_bytes,
      title: prescription.title, blockchainStatus: prescription.blockchain_status, createdAt: prescription.created_at
    };
  }
}
