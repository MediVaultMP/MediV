import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { createAuthRouter } from './routes/auth-routes.js';
import { createHealthRouter } from './routes/health-routes.js';
import { createPatientRouter } from './routes/patient-routes.js';
import { createDoctorMedicalRecordRouter, createMedicalRecordRouter } from './routes/medical-record-routes.js';
import { createConsentRouter } from './routes/consent-routes.js';
import { createAccountRouter } from './routes/account-routes.js';
import { errorHandler, notFound } from './middleware/error-handler.js';

export function createApp({ authService, patientProfileService, medicalRecordService, walletService, consentService }) {
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
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
