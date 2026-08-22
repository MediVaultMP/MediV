import { AppError } from '../utils/app-error.js';

export class ConsentService {
  constructor({ consentRepository, userRepository, recordRegistryClient, auditService }) {
    this.consentRepository = consentRepository;
    this.userRepository = userRepository;
    this.recordRegistryClient = recordRegistryClient;
    this.auditService = auditService;
  }

  async grant(patientUserId, doctorUserId, expiresAt) {
    const { patient, doctor } = await this.getParties(patientUserId, doctorUserId);
    if (expiresAt <= new Date()) throw new AppError(400, 'Consent expiry must be in the future.', 'INVALID_EXPIRY');
    try {
      const transactionHash = await this.recordRegistryClient.grantAccess({ patientAddress: patient.blockchain_address, doctorAddress: doctor.blockchain_address, expiresAt });
      const consent = await this.consentRepository.grant({ patientUserId, doctorUserId, expiresAt, transactionHash });
      await this.auditService?.record({ eventType: 'consent_granted', actorUserId: patientUserId, subjectUserId: patientUserId, resourceType: 'consent', resourceId: null, metadata: { doctorUserId }, expiresAt });
      return this.publicConsent(consent, doctor.email);
    } catch {
      throw new AppError(502, 'Blockchain consent registration failed.', 'BLOCKCHAIN_CONSENT_FAILED');
    }
  }

  async revoke(patientUserId, doctorUserId) {
    const { patient, doctor } = await this.getParties(patientUserId, doctorUserId);
    const existing = await this.consentRepository.findActive(patientUserId, doctorUserId);
    if (!existing) throw new AppError(404, 'Active consent was not found.', 'CONSENT_NOT_FOUND');
    try {
      const transactionHash = await this.recordRegistryClient.revokeAccess({ patientAddress: patient.blockchain_address, doctorAddress: doctor.blockchain_address });
      const consent = await this.consentRepository.revoke({ patientUserId, doctorUserId, transactionHash });
      await this.auditService?.record({ eventType: 'consent_revoked', actorUserId: patientUserId, subjectUserId: patientUserId, resourceType: 'consent', resourceId: null, metadata: { doctorUserId } });
      return this.publicConsent(consent, doctor.email);
    } catch {
      throw new AppError(502, 'Blockchain consent revocation failed.', 'BLOCKCHAIN_CONSENT_FAILED');
    }
  }

  async listForPatient(patientUserId) {
    return (await this.consentRepository.listActiveForPatient(patientUserId)).map((consent) => this.publicConsent(consent, consent.doctor_email));
  }

  async assertDoctorAccess(patientUserId, doctorUserId) {
    const consent = await this.consentRepository.findActive(patientUserId, doctorUserId);
    if (!consent) throw new AppError(403, 'Active patient consent is required.', 'CONSENT_REQUIRED');
    const { patient, doctor } = await this.getParties(patientUserId, doctorUserId);
    try {
      if (!(await this.recordRegistryClient.hasAccess({ patientAddress: patient.blockchain_address, doctorAddress: doctor.blockchain_address }))) {
        throw new AppError(403, 'Patient consent is no longer active.', 'CONSENT_REQUIRED');
      }
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(503, 'Consent verification is temporarily unavailable.', 'CONSENT_VERIFICATION_UNAVAILABLE');
    }
  }

  async getParties(patientUserId, doctorUserId) {
    const [patient, doctor] = await Promise.all([this.userRepository.findById(patientUserId), this.userRepository.findById(doctorUserId)]);
    if (!doctor || doctor.role !== 'doctor') throw new AppError(404, 'Doctor not found.', 'DOCTOR_NOT_FOUND');
    if (!patient?.blockchain_address || !doctor.blockchain_address) {
      throw new AppError(409, 'Both patient and doctor must have blockchain wallet addresses.', 'WALLET_REQUIRED');
    }
    return { patient, doctor };
  }

  publicConsent(consent, doctorEmail) {
    return { doctorUserId: consent.doctor_user_id, doctorEmail, expiresAt: consent.expires_at, createdAt: consent.created_at, updatedAt: consent.updated_at };
  }
}
