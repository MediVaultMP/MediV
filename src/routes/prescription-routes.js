import { Router } from "express";
import multer from "multer";
import path from "node:path";

import { createPrescriptionController } from "../controllers/prescription-controller.js";
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
 * Validate the uploaded file's signature after Multer receives it.
 * This helps reject files whose extension or MIME type does not
 * match their actual format.
 */
function validatePrescriptionFile(req, res, next) {
  try {
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
        Buffer.from([
          0x89, 0x50, 0x4e, 0x47,
          0x0d, 0x0a, 0x1a, 0x0a,
        ])
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
// DOCTOR PRESCRIPTION ROUTES
// --------------------------------------------------

export function createDoctorPrescriptionRouter(
  authService,
  prescriptionService
) {
  const router = Router();
  const controller = createPrescriptionController(prescriptionService);

  router.get(
    "/prescriptions",
    authenticate(authService),
    authorize("patient"),
    controller.listForPatient
  );

  router.post(
    "/prescriptions",
    authenticate(authService),
    authorize("doctor"),
    upload.single("document"),
    validatePrescriptionFile,
    controller.create
  );

  return router;
}

// --------------------------------------------------
// PHARMACY PRESCRIPTION ROUTES
// --------------------------------------------------

export function createPharmacyPrescriptionRouter(
  authService,
  prescriptionService
) {
  const router = Router();
  const controller = createPrescriptionController(prescriptionService);

  router.get(
    "/history",
    authenticate(authService),
    authorize("pharmacy"),
    controller.pharmacyHistory
  );

  router.get(
    "/prescriptions/:prescriptionId/verify",
    authenticate(authService),
    authorize("pharmacy"),
    controller.verifyForPharmacy
  );

  return router;
}

// --------------------------------------------------
// PATIENT PRESCRIPTION ROUTES
// --------------------------------------------------

export function createPatientPrescriptionRouter(
  authService,
  prescriptionService
) {
  const router = Router();
  const controller = createPrescriptionController(prescriptionService);

  router.get(
    "/me/prescriptions",
    authenticate(authService),
    authorize("patient"),
    controller.listForPatient
  );

  return router;
}