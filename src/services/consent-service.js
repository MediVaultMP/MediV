import { AppError } from '../utils/app-error.js';

export class ConsentService {
  constructor({
    consentRepository,
    userRepository,
    recordRegistryClient,
    auditService
  }) {
    this.consentRepository = consentRepository;
    this.userRepository = userRepository;
    this.recordRegistryClient = recordRegistryClient;
    this.auditService = auditService;
  }

  async listForPatient(patientUserId) {
    const consents =
      await this.consentRepository.listActiveForPatient(patientUserId);

    return consents.map(c => ({
      doctorUserId: c.doctor_user_id,
      doctorEmail: c.doctor_email,
      expiresAt: c.expires_at,
      createdAt: c.created_at
    }));
  }

  async listForDoctor(doctorUserId) {
    const consents =
      await this.consentRepository.listActiveForDoctor(doctorUserId);

    return consents.map(c => ({
      patientUserId: c.patient_user_id,
      patientEmail: c.patient_email,
      expiresAt: c.expires_at,
      createdAt: c.created_at
    }));
  }

  async grant(patientUserId, doctorId, expiresAt) {
    if (
      !expiresAt ||
      !Number.isFinite(new Date(expiresAt).getTime()) ||
      new Date(expiresAt).getTime() <= Date.now()
    ) {
      throw new AppError(
        400,
        'Consent expiry must be a future date.',
        'INVALID_CONSENT_EXPIRY'
      );
    }

    const expiry = new Date(expiresAt);

    const patient = await this.userRepository.findById(patientUserId);
    if (!patient) {
      throw new AppError(404, 'Patient not found.', 'PATIENT_NOT_FOUND');
    }

    const doctor = await this.userRepository.findById(doctorId);
    if (!doctor) {
      throw new AppError(404, 'Doctor not found.', 'DOCTOR_NOT_FOUND');
    }

    const existing =
      await this.consentRepository.findActive(patientUserId, doctorId);

    if (existing) {
      throw new AppError(
        409,
        'Consent already exists for this doctor.',
        'CONSENT_EXISTS'
      );
    }

    if (!patient.blockchain_address || !doctor.blockchain_address) {
      throw new AppError(
        400,
        'Both patient and doctor must have registered blockchain wallets.',
        'WALLET_NOT_CONFIGURED'
      );
    }

    if (!this.recordRegistryClient?.grantAccess) {
      throw new AppError(
        503,
        'Blockchain registry is unavailable.',
        'BLOCKCHAIN_UNAVAILABLE'
      );
    }

    // Grant access on the deployed blockchain contract.
    const transactionHash = await this.recordRegistryClient.grantAccess({
      patientAddress: patient.blockchain_address,
      doctorAddress: doctor.blockchain_address,
      expiresAt: expiry
    });

    // Save the consent and transaction hash in PostgreSQL.
    const consent = await this.consentRepository.grant({
      patientUserId,
      doctorUserId: doctorId,
      expiresAt: expiry,
      transactionHash
    });

    await this.auditService?.record({
      eventType: 'consent_granted',
      actorUserId: patientUserId,
      subjectUserId: patientUserId,
      resourceType: 'consent',
      resourceId: consent.id,
      metadata: { doctorId, transactionHash }
    });

    return {
      id: consent.id,
      patientUserId: consent.patient_user_id,
      doctorUserId: consent.doctor_user_id,
      expiresAt: consent.expires_at,
      createdAt: consent.created_at
    };
  }

  async revoke(patientUserId, doctorId) {
    const existing =
      await this.consentRepository.findActive(patientUserId, doctorId);

    if (!existing) {
      throw new AppError(
        404,
        'Consent not found.',
        'CONSENT_NOT_FOUND'
      );
    }

    const patient = await this.userRepository.findById(patientUserId);
    const doctor = await this.userRepository.findById(doctorId);

    if (
      !patient?.blockchain_address ||
      !doctor?.blockchain_address
    ) {
      throw new AppError(
        400,
        'Patient and doctor wallet details are required to revoke access.',
        'WALLET_NOT_CONFIGURED'
      );
    }

    if (!this.recordRegistryClient?.revokeAccess) {
      throw new AppError(
        503,
        'Blockchain registry is unavailable.',
        'BLOCKCHAIN_UNAVAILABLE'
      );
    }

    // Revoke access on-chain before updating the database.
    const transactionHash = await this.recordRegistryClient.revokeAccess({
      patientAddress: patient.blockchain_address,
      doctorAddress: doctor.blockchain_address
    });

    const revoked = await this.consentRepository.revoke({
      patientUserId,
      doctorUserId: doctorId,
      transactionHash
    });

    if (!revoked) {
      throw new AppError(
        409,
        'Consent could not be updated in the database.',
        'CONSENT_UPDATE_FAILED'
      );
    }

    await this.auditService?.record({
      eventType: 'consent_revoked',
      actorUserId: patientUserId,
      subjectUserId: patientUserId,
      resourceType: 'consent',
      resourceId: revoked.id,
      metadata: { doctorId, transactionHash }
    });

    return {
      id: revoked.id,
      patientUserId: revoked.patient_user_id,
      doctorUserId: revoked.doctor_user_id,
      revokedAt: revoked.revoked_at
    };
  }

  async assertDoctorAccess(patientUserId, doctorUserId) {
    // Reject missing, expired, or revoked database consent first.
    const consent =
      await this.consentRepository.findActive(patientUserId, doctorUserId);

    if (!consent) {
      throw new AppError(
        403,
        'Valid patient consent is required to access these records.',
        'CONSENT_REQUIRED'
      );
    }

    const patient = await this.userRepository.findById(patientUserId);
    const doctor = await this.userRepository.findById(doctorUserId);

    if (!patient?.blockchain_address || !doctor?.blockchain_address) {
      throw new AppError(
        403,
        'Valid patient consent is required to access these records.',
        'CONSENT_REQUIRED'
      );
    }

    if (!this.recordRegistryClient?.hasAccess) {
      throw new AppError(
        503,
        'Blockchain registry is unavailable.',
        'BLOCKCHAIN_UNAVAILABLE'
      );
    }

    const hasAccess = await this.recordRegistryClient.hasAccess({
      patientAddress: patient.blockchain_address,
      doctorAddress: doctor.blockchain_address
    });

    if (!hasAccess) {
      throw new AppError(
        403,
        'Valid patient consent is required to access these records.',
        'CONSENT_REQUIRED'
      );
    }
  }
}