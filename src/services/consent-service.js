import { AppError } from '../utils/app-error.js';

export class ConsentService {
  constructor({ consentRepository, userRepository, recordRegistryClient, auditService }) {
    this.consentRepository = consentRepository;
    this.userRepository = userRepository;
    this.recordRegistryClient = recordRegistryClient;
    this.auditService = auditService;
  }

  async listForPatient(patientUserId) {
    const consents = await this.consentRepository.listActiveForPatient(patientUserId);
    return consents.map(c => ({
      doctorUserId: c.doctor_user_id,
      doctorEmail: c.doctor_email,
      expiresAt: c.expires_at,
      createdAt: c.created_at
    }));
  }

  async listForDoctor(doctorUserId) {
    const consents = await this.consentRepository.listActiveForDoctor(doctorUserId);
    return consents.map(c => ({
      patientUserId: c.patient_user_id,
      patientEmail: c.patient_email,
      expiresAt: c.expires_at,
      createdAt: c.created_at
    }));
  }

  async grant(patientUserId, doctorId, expiresAt) {
    // Check if patient exists
    const patient = await this.userRepository.findById(patientUserId);
    if (!patient) {
      throw new AppError(404, 'Patient not found.', 'PATIENT_NOT_FOUND');
    }

    // Check if doctor exists
    const doctor = await this.userRepository.findById(doctorId);
    if (!doctor) {
      throw new AppError(404, 'Doctor not found.', 'DOCTOR_NOT_FOUND');
    }

    // Check if consent already exists and is active
    const existing = await this.consentRepository.findActive(patientUserId, doctorId);
    if (existing) {
      throw new AppError(409, 'Consent already exists for this doctor.', 'CONSENT_EXISTS');
    }

    // Create consent (skip blockchain transaction hash for demo)
    const consent = await this.consentRepository.grant({
      patientUserId,
      doctorUserId: doctorId,
      expiresAt: expiresAt || '2026-12-31T23:59:59Z',
      transactionHash: null
    });

    // Audit log
    await this.auditService?.record({
      eventType: 'consent_granted',
      actorUserId: patientUserId,
      subjectUserId: patientUserId,
      resourceType: 'consent',
      resourceId: consent.id,
      metadata: { doctorId }
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
    const existing = await this.consentRepository.findActive(patientUserId, doctorId);
    if (!existing) {
      throw new AppError(404, 'Consent not found.', 'CONSENT_NOT_FOUND');
    }

    const revoked = await this.consentRepository.revoke({
      patientUserId,
      doctorUserId: doctorId,
      transactionHash: null
    });

    // Audit log
    await this.auditService?.record({
      eventType: 'consent_revoked',
      actorUserId: patientUserId,
      subjectUserId: patientUserId,
      resourceType: 'consent',
      resourceId: revoked.id,
      metadata: { doctorId }
    });

    return {
      id: revoked.id,
      patientUserId: revoked.patient_user_id,
      doctorUserId: revoked.doctor_user_id,
      revokedAt: revoked.revoked_at
    };
  }

  async assertDoctorAccess(patientUserId, doctorUserId) {
    const consent = await this.consentRepository.findActive(patientUserId, doctorUserId);
    if (!consent) {
      throw new AppError(403, 'You do not have access to this patient\'s records.', 'ACCESS_DENIED');
    }
    return {
      id: consent.id,
      patientUserId: consent.patient_user_id,
      doctorUserId: consent.doctor_user_id,
      expiresAt: consent.expires_at
    };
  }
}