import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { createAuthRouter } from './routes/auth-routes.js';
import { createHealthRouter } from './routes/health-routes.js';
import { createPatientRouter } from './routes/patient-routes.js';
import { createDoctorMedicalRecordRouter, createMedicalRecordRouter } from './routes/medical-record-routes.js';
import { createConsentRouter, createDoctorConsentRouter } from './routes/consent-routes.js';
import { createAccountRouter } from './routes/account-routes.js';
import { createDoctorPrescriptionRouter, createPharmacyPrescriptionRouter } from './routes/prescription-routes.js';
import { createEmergencyAccessRouter } from './routes/emergency-access-routes.js';
import { createAuditRouter } from './routes/audit-routes.js';
import { createAdminRouter } from './routes/admin-routes.js';
import { errorHandler, notFound } from './middleware/error-handler.js';

export function createApp({ authService, patientProfileService, medicalRecordService, walletService, consentService, prescriptionService, emergencyAccessService, auditRepository, adminService }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));
  app.use('/api/v1/auth', createAuthRouter(authService));
  app.use('/api/v1/health', createHealthRouter(authService));
  if (patientProfileService) app.use('/api/v1/patients', createPatientRouter(authService, patientProfileService, walletService));
  if (walletService) app.use('/api/v1/account', createAccountRouter(authService, walletService));
  if (medicalRecordService) app.use('/api/v1/patients', createMedicalRecordRouter(authService, medicalRecordService));
  if (consentService) app.use('/api/v1/consents', createConsentRouter(authService, consentService));
  if (medicalRecordService && consentService) app.use('/api/v1/doctor', createDoctorMedicalRecordRouter(authService, medicalRecordService));
  if (prescriptionService) {
    app.use('/api/v1/doctor', createDoctorPrescriptionRouter(authService, prescriptionService));
    app.use('/api/v1/pharmacy', createPharmacyPrescriptionRouter(authService, prescriptionService));
  }
  if (consentService) app.use('/api/v1/doctor', createDoctorConsentRouter(authService, consentService));
  if (emergencyAccessService) app.use('/api/v1/emergency-access', createEmergencyAccessRouter(authService, emergencyAccessService));
  if (auditRepository) app.use('/api/v1/audit-events', createAuditRouter(authService, auditRepository));
  if (adminService) app.use('/api/v1/admin', createAdminRouter(authService, adminService));
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
