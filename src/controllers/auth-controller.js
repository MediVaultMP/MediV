import { z } from 'zod';
import { asyncHandler } from '../utils/async-handler.js';

const credentials = z.object({
  email: z.string().email().max(254),
  password: z.string().min(12).max(128)
});
const registration = credentials.extend({ role: z.enum(['patient', 'doctor', 'pharmacy']) });

export function createAuthController(authService) {
  return {
    register: asyncHandler(async (req, res) => {
      const input = registration.parse(req.body);
      const { user, token } = await authService.register(input);
      res.status(201).json({ user: authService.publicUser(user), token });
    }),
    login: asyncHandler(async (req, res) => {
      const input = credentials.parse(req.body);
      const result = await authService.login(input);
      res.json(result);
    })
  };
}
