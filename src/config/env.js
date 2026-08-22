import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().min(1),
  DATABASE_SSL: z.enum(['true', 'false']).default('false'),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('1h'),
  AWS_REGION: z.string().min(1),
  S3_MEDICAL_RECORDS_BUCKET: z.string().min(3).max(63),
  FILE_ENCRYPTION_KEY: z.string().refine(
    (value) => Buffer.from(value, 'base64').length === 32,
    'FILE_ENCRYPTION_KEY must be a base64-encoded 32-byte key.'
  ),
  BLOCKCHAIN_RPC_URL: z.string().url(),
  BLOCKCHAIN_CHAIN_ID: z.coerce.number().int().positive(),
  BLOCKCHAIN_CONTRACT_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  BLOCKCHAIN_PRIVATE_KEY: z.string().regex(/^0x[a-fA-F0-9]{64}$/)
});

export function loadEnv(source = process.env) {
  return schema.parse(source);
}
