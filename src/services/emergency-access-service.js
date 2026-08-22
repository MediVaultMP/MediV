import { AppError } from '../utils/app-error.js';

const MAX_DURATION_MS = 60 * 60 * 1000;

export class EmergencyAccessService {
  constructor({ emergencyAccessRepository, userRepository, medicalRecordRepository, auditService }) {
    this.emergencyAccessRepository = emergencyAccessRepository;
    this.userRepository = userRepository;
    this.medicalRecordRepository = medicalRecordRepository;
    this.auditService = auditService;
  }

  async grant(doctorUserId, patientUserId, reason, expiresAt) {
    const doctor = await this.userRepository.findById(doctorUserId);
    const patient = await this.userRepository.findById(patientUserId);
    if (!patient || !doctor || doctor.role !== 'doctor') throw new AppError(404, 'Patient or doctor not found.', 'USER_NOT_FOUND');
    const now = Date.now();
    if (expiresAt <= new Date(now) || expiresAt.getTime() > now + MAX_DURATION_MS) {
      throw new AppError(400, 'Emergency access must expire within one hour.', 'INVALID_EMERGENCY_EXPIRY');
    }
    const grant = await this.emergencyAccessRepository.create({ patientUserId, doctorUserId, reason, expiresAt });
    await this.auditService.record({
      eventType: 'emergency_access_granted', actorUserId: doctorUserId, subjectUserId: patientUserId,
      resourceType: 'emergency_access', resourceId: grant.id, metadata: { reason }, expiresAt
    });
    return this.publicGrant(grant);
  }

  async listEssentialRecords(doctorUserId, patientUserId) {
    const grant = await this.emergencyAccessRepository.findActive(patientUserId, doctorUserId);
    if (!grant) throw new AppError(403, 'Active emergency access is required.', 'EMERGENCY_ACCESS_REQUIRED');
    const records = await this.medicalRecordRepository.listEssentialForPatient(patientUserId);
    await this.auditService.record({
      eventType: 'emergency_records_accessed', actorUserId: doctorUserId, subjectUserId: patientUserId,
      resourceType: 'emergency_access', resourceId: grant.id, metadata: { recordCount: records.length }, expiresAt: grant.expires_at
    });
    return records;
  }

  publicGrant(grant) {
    return { id: grant.id, patientUserId: grant.patient_user_id, doctorUserId: grant.doctor_user_id, expiresAt: grant.expires_at, createdAt: grant.created_at };
  }
}
