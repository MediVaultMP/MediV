import { S3Client } from '@aws-sdk/client-s3';
import { S3MedicalStorage } from '../services/s3-medical-storage.js';

export function createMedicalStorage(config) {
  return new S3MedicalStorage({
    client: new S3Client({ region: config.AWS_REGION }),
    bucket: config.S3_MEDICAL_RECORDS_BUCKET
  });
}
