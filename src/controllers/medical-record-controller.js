import { z } from 'zod';
import { asyncHandler } from '../utils/async-handler.js';

const uploadMetadata = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  category: z.enum([
    'lab-result',
    'imaging',
    'prescription',
    'clinical-note',
    'other'
  ]).optional()
}).strict();

const recordId = z.object({
  recordId: z.string().uuid()
});

const patientRecordParams = z.object({
  patientId: z.string().uuid(),
  recordId: z.string().uuid()
});

const patientIdParams = z.object({
  patientId: z.string().uuid()
});

const accessRequestParams = z.object({
  requestId: z.string().uuid()
});

const emergencyEssential = z.object({
  isEmergencyEssential: z.boolean()
}).strict();

export function createMedicalRecordController(medicalRecordService) {
  return {
    // -----------------------------------------------
    // PATIENT: UPLOAD AND MANAGE RECORDS
    // -----------------------------------------------

    uploadOwn: asyncHandler(async (req, res) => {
      const record = await medicalRecordService.uploadOwnRecord(
        req.user.sub,
        req.file,
        uploadMetadata.parse(req.body)
      );

      res.status(201).json({ record });
    }),

    uploadForDoctor: asyncHandler(async (req, res) => {
      const { patientId } = patientIdParams.parse(req.params);

      const record = await medicalRecordService.uploadRecordForDoctor(
        req.user.sub,
        patientId,
        req.file,
        uploadMetadata.parse(req.body)
      );

      res.status(201).json({ record });
    }),

    listOwn: asyncHandler(async (req, res) => {
      const records = await medicalRecordService.listOwnRecords(
        req.user.sub
      );

      res.json({ records });
    }),

    downloadOwn: asyncHandler(async (req, res) => {
      const { recordId: id } = recordId.parse(req.params);

      const { record, body } =
        await medicalRecordService.downloadOwnRecord(
          req.user.sub,
          id
        );

      res.type(record.contentType);
      res.attachment(record.originalFilename);
      res.send(body);
    }),

    verifyOwn: asyncHandler(async (req, res) => {
      const { recordId: id } = recordId.parse(req.params);

      const verification =
        await medicalRecordService.verifyOwnRecord(
          req.user.sub,
          id
        );

      res.json({ verification });
    }),

    registerOwnOnChain: asyncHandler(async (req, res) => {
      const { recordId: id } = recordId.parse(req.params);

      const record =
        await medicalRecordService.registerOwnRecordOnChain(
          req.user.sub,
          id
        );

      res.json({ record });
    }),

    // -----------------------------------------------
    // DOCTOR: LIST FILES AND DOWNLOAD APPROVED FILES
    // -----------------------------------------------

    listForDoctor: asyncHandler(async (req, res) => {
      const { patientId } = patientIdParams.parse(req.params);

      const records =
        await medicalRecordService.listRecordsForDoctor(
          req.user.sub,
          patientId
        );

      res.json({ records });
    }),

    downloadForDoctor: asyncHandler(async (req, res) => {
      const { patientId, recordId: id } =
        patientRecordParams.parse(req.params);

      const { record, body } =
        await medicalRecordService.downloadRecordForDoctor(
          req.user.sub,
          patientId,
          id
        );

      res.type(record.contentType);
      res.attachment(record.originalFilename);
      res.send(body);
    }),

    // -----------------------------------------------
    // DOCTOR: REQUEST ACCESS TO ONE FILE
    // -----------------------------------------------

    requestRecordAccess: asyncHandler(async (req, res) => {
      const { patientId, recordId: id } =
        patientRecordParams.parse(req.params);

      const request =
        await medicalRecordService.requestRecordAccess(
          req.user.sub,
          patientId,
          id
        );

      res.status(201).json({ request });
    }),

    // -----------------------------------------------
    // PATIENT: VIEW ACCESS REQUESTS
    // -----------------------------------------------

    listAccessRequestsForPatient: asyncHandler(async (req, res) => {
      const requests =
        await medicalRecordService.listRecordAccessRequestsForPatient(
          req.user.sub
        );

      res.json({ requests });
    }),

    // -----------------------------------------------
    // PATIENT: APPROVE A FILE REQUEST
    // -----------------------------------------------

    approveRecordAccess: asyncHandler(async (req, res) => {
      const { requestId } =
        accessRequestParams.parse(req.params);

      const request =
        await medicalRecordService.decideRecordAccessRequest(
          req.user.sub,
          requestId,
          'approved'
        );

      res.json({ request });
    }),

    // -----------------------------------------------
    // PATIENT: REJECT A FILE REQUEST
    // -----------------------------------------------

    rejectRecordAccess: asyncHandler(async (req, res) => {
      const { requestId } =
        accessRequestParams.parse(req.params);

      const request =
        await medicalRecordService.decideRecordAccessRequest(
          req.user.sub,
          requestId,
          'rejected'
        );

      res.json({ request });
    }),

    // -----------------------------------------------
    // PATIENT: REVOKE PREVIOUSLY APPROVED ACCESS
    // -----------------------------------------------

    revokeRecordAccess: asyncHandler(async (req, res) => {
      const { requestId } =
        accessRequestParams.parse(req.params);

      const request =
        await medicalRecordService.decideRecordAccessRequest(
          req.user.sub,
          requestId,
          'revoked'
        );

      res.json({ request });
    }),

    // -----------------------------------------------
    // PATIENT: EMERGENCY RECORD CLASSIFICATION
    // -----------------------------------------------

    setOwnEmergencyEssential: asyncHandler(async (req, res) => {
      const { recordId: id } = recordId.parse(req.params);

      const { isEmergencyEssential } =
        emergencyEssential.parse(req.body);

      const record =
        await medicalRecordService.setOwnRecordEmergencyEssential(
          req.user.sub,
          id,
          isEmergencyEssential
        );

      res.json({ record });
    })
  };
}