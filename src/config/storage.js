import { LocalMedicalStorage } from '../services/local-medical-storage.js';

export function createMedicalStorage(config) {
  console.log('✅ Using Local Medical Storage (files saved to ./uploads)');
  return new LocalMedicalStorage({ baseDir: './uploads' });
}
