import { Router } from "express";
import multer from "multer";
import path from "node:path";

import { createMedicalRecordController } from "../controllers/medical-record-controller.js";
import { authenticate } from "../middleware/authenticate.js";
import { authorize } from "../middleware/authorize.js";
import { AppError } from "../utils/app-error.js";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const allowedExtensions = new Set([".pdf", ".jpg", ".jpeg", ".png"]);

const allowedMimeTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
]);

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1,
  },

  fileFilter: (req, file, callback) => {
    const extension = path.extname(file.originalname || "").toLowerCase();

    if (
      !allowedExtensions.has(extension) ||
      !allowedMimeTypes.has(file.mimetype)
    ) {
      return callback(
        new AppError(
          400,
          "Only PDF, JPG, JPEG, and PNG files are allowed.",
          "INVALID_FILE_TYPE"
        )
      );
    }

    callback(null, true);
  },
});

/**
 * Check the uploaded file's actual signature (magic bytes).
 * File extensions and MIME types alone are not reliable evidence
 * of the file's actual format.
 */
function validateUploadedFile(req, res, next) {
  try {
    // Let the controller handle a missing file, if applicable.
    if (!req.file) {
      return next();
    }

    const { originalname, mimetype, buffer } = req.file;
    const extension = path.extname(originalname || "").toLowerCase();

    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
      throw new AppError(
        400,
        "The uploaded file is empty or invalid.",
        "INVALID_FILE"
      );
    }

    const isPdf =
      extension === ".pdf" &&
      mimetype === "application/pdf" &&
      buffer.subarray(0, 5).toString("ascii") === "%PDF-";

    const isJpeg =
      (extension === ".jpg" || extension === ".jpeg") &&
      mimetype === "image/jpeg" &&
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff;

    const isPng =
      extension === ".png" &&
      mimetype === "image/png" &&
      buffer.length >= 8 &&
      buffer.subarray(0, 8).equals(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
      );

    if (!isPdf && !isJpeg && !isPng) {
      throw new AppError(
        400,
        "The file content does not match a supported PDF, JPG, JPEG, or PNG format.",
        "INVALID_FILE_SIGNATURE"
      );
    }

    next();
  } catch (error) {
    next(error);
  }
}

// --------------------------------------------------
// PATIENT MEDICAL RECORD ROUTES
// --------------------------------------------------

export function createMedicalRecordRouter(
  authService,
  medicalRecordService
) {
  const router = Router();
  const controller =
    createMedicalRecordController(medicalRecordService);

  router.use(
    authenticate(authService),
    authorize("patient")
  );

  // Upload personal medical records.
  router.post(
    "/me/records",
    upload.single("document"),
    validateUploadedFile,
    controller.uploadOwn
  );

  // List personal records.
  router.get(
    "/me/records",
    controller.listOwn
  );

  // Download a personal record.
  router.get(
    "/me/records/:recordId/download",
    controller.downloadOwn
  );

  // Verify record integrity.
  router.post(
    "/me/records/:recordId/verify",
    controller.verifyOwn
  );

  // Register a record on-chain.
  router.post(
    "/me/records/:recordId/register-on-chain",
    controller.registerOwnOnChain
  );

  // Mark or unmark an emergency-essential record.
  router.patch(
    "/me/records/:recordId/emergency-essential",
    controller.setOwnEmergencyEssential
  );

  // View individual-file access requests.
  router.get(
    "/me/record-access-requests",
    controller.listAccessRequestsForPatient
  );

  // Approve a doctor's request.
  router.post(
    "/me/record-access-requests/:requestId/approve",
    controller.approveRecordAccess
  );

  // Reject a doctor's request.
  router.post(
    "/me/record-access-requests/:requestId/reject",
    controller.rejectRecordAccess
  );

  // Revoke previously approved access.
  router.post(
    "/me/record-access-requests/:requestId/revoke",
    controller.revokeRecordAccess
  );

  return router;
}

// --------------------------------------------------
// DOCTOR MEDICAL RECORD ROUTES
// --------------------------------------------------

export function createDoctorMedicalRecordRouter(
  authService,
  medicalRecordService
) {
  const router = Router();
  const controller =
    createMedicalRecordController(medicalRecordService);

  router.use(
    authenticate(authService),
    authorize("doctor")
  );

  // List patient record metadata.
  router.get(
    "/patients/:patientId/records",
    controller.listForDoctor
  );

  // Request access to one specific file.
  router.post(
    "/patients/:patientId/records/:recordId/access-request",
    controller.requestRecordAccess
  );

  // Upload a record for a patient.
  router.post(
    "/patients/:patientId/records",
    upload.single("document"),
    validateUploadedFile,
    controller.uploadForDoctor
  );

  // Download a record after the service authorizes access.
  router.get(
    "/patients/:patientId/records/:recordId/download",
    controller.downloadForDoctor
  );

  return router;
}
