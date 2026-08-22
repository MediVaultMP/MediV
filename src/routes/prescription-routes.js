import { Router } from 'express';
import multer from 'multer';
import { createPrescriptionController } from '../controllers/prescription-controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';

const allowedTypes = new Set(['application/pdf', 'image/jpeg', 'image/png']);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, callback) => callback(null, allowedTypes.has(file.mimetype))
});

export function createDoctorPrescriptionRouter(authService, prescriptionService) {
  const router = Router();
  const controller = createPrescriptionController(prescriptionService);
  router.post('/prescriptions', authenticate(authService), authorize('doctor'), upload.single('document'), controller.create);
  return router;
}

export function createPharmacyPrescriptionRouter(authService, prescriptionService) {
  const router = Router();
  const controller = createPrescriptionController(prescriptionService);
  router.get('/prescriptions/:prescriptionId/verify', authenticate(authService), authorize('pharmacy'), controller.verifyForPharmacy);
  return router;
}
