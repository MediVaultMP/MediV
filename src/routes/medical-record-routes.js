import { Router } from 'express';
import multer from 'multer';
import { createMedicalRecordController } from '../controllers/medical-record-controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';

const allowedTypes = new Set(['application/pdf', 'image/jpeg', 'image/png']);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, callback) => callback(null, allowedTypes.has(file.mimetype))
});

export function createMedicalRecordRouter(authService, medicalRecordService) {
  const router = Router();
  const controller = createMedicalRecordController(medicalRecordService);
  router.use(authenticate(authService), authorize('patient'));
  router.get('/me/records', controller.listOwn);
  router.post('/me/records', upload.single('document'), controller.uploadOwn);
  router.post('/me/records/:recordId/verify', controller.verifyOwn);
  router.post('/me/records/:recordId/register-on-chain', controller.registerOwnOnChain);
  router.get('/me/records/:recordId/download', controller.downloadOwn);
  return router;
}

export function createDoctorMedicalRecordRouter(authService, medicalRecordService) {
  const router = Router();
  const controller = createMedicalRecordController(medicalRecordService);
  router.use(authenticate(authService), authorize('doctor'));
  router.get('/patients/:patientId/records', controller.listForDoctor);
  router.get('/patients/:patientId/records/:recordId/download', controller.downloadForDoctor);
  return router;
}
