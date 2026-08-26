import { z } from 'zod';
import { asyncHandler } from '../utils/async-handler.js';

const uploadMetadata = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  category: z.enum(['lab-result', 'imaging', 'prescription', 'clinical-note', 'other']).optional()
}).strict();
const recordId = z.object({ recordId: z.string().uuid() });
const patientRecordParams = z.object({ patientId: z.string().uuid(), recordId: z.string().uuid() });
const patientIdParams = z.object({ patientId: z.string().uuid() });
const emergencyEssential = z.object({ isEmergencyEssential: z.boolean() }).strict();

export function createMedicalRecordController(medicalRecordService) {
  return {
    uploadOwn: asyncHandler(async (req, res) => {
      const record = await medicalRecordService.uploadOwnRecord(req.user.sub, req.file, uploadMetadata.parse(req.body));
      res.status(201).json({ record });
    }),
    uploadForDoctor: asyncHandler(async (req, res) => {
      const { patientId } = patientIdParams.parse(req.params);
      const record = await medicalRecordService.uploadRecordForDoctor(req.user.sub, patientId, req.file, uploadMetadata.parse(req.body));
      res.status(201).json({ record });
    }),
    listOwn: asyncHandler(async (req, res) => {
      res.json({ records: await medicalRecordService.listOwnRecords(req.user.sub) });
    }),
    downloadOwn: asyncHandler(async (req, res) => {
      const { recordId: id } = recordId.parse(req.params);
      const { record, body } = await medicalRecordService.downloadOwnRecord(req.user.sub, id);
      res.type(record.contentType);
      res.attachment(record.originalFilename);
      res.send(body);
    }),
    verifyOwn: asyncHandler(async (req, res) => {
      const { recordId: id } = recordId.parse(req.params);
      res.json({ verification: await medicalRecordService.verifyOwnRecord(req.user.sub, id) });
    }),
    registerOwnOnChain: asyncHandler(async (req, res) => {
      const { recordId: id } = recordId.parse(req.params);
      res.json({ record: await medicalRecordService.registerOwnRecordOnChain(req.user.sub, id) });
    }),
    listForDoctor: asyncHandler(async (req, res) => {
      const { patientId } = patientIdParams.parse(req.params);
      res.json({ records: await medicalRecordService.listRecordsForDoctor(req.user.sub, patientId) });
    }),
    downloadForDoctor: asyncHandler(async (req, res) => {
      const { patientId, recordId: id } = patientRecordParams.parse(req.params);
      const { record, body } = await medicalRecordService.downloadRecordForDoctor(req.user.sub, patientId, id);
      res.type(record.contentType);
      res.attachment(record.originalFilename);
      res.send(body);
    }),
    setOwnEmergencyEssential: asyncHandler(async (req, res) => {
      const { recordId: id } = recordId.parse(req.params);
      const { isEmergencyEssential } = emergencyEssential.parse(req.body);
      res.json({ record: await medicalRecordService.setOwnRecordEmergencyEssential(req.user.sub, id, isEmergencyEssential) });
    })
  };
}
