import { z } from 'zod';
import { asyncHandler } from '../utils/async-handler.js';

const grantSchema = z.object({ doctorId: z.string().uuid(), expiresAt: z.coerce.date() }).strict();
const doctorIdSchema = z.object({ doctorId: z.string().uuid() });

export function createConsentController(consentService) {
  return {
    grant: asyncHandler(async (req, res) => {
      const { doctorId, expiresAt } = grantSchema.parse(req.body);
      res.status(201).json({ consent: await consentService.grant(req.user.sub, doctorId, expiresAt) });
    }),
    revoke: asyncHandler(async (req, res) => {
      const { doctorId } = doctorIdSchema.parse(req.params);
      res.json({ consent: await consentService.revoke(req.user.sub, doctorId) });
    }),
    listOwn: asyncHandler(async (req, res) => {
      res.json({ consents: await consentService.listForPatient(req.user.sub) });
    })
  };
}
