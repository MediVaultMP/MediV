import { createApp } from './app.js';
import { createDatabase } from './config/database.js';
import { createMedicalStorage } from './config/storage.js';
import { RecordRegistryClient } from './blockchain/record-registry-client.js';
import { loadEnv } from './config/env.js';
import { UserRepository } from './models/user-repository.js';
import { PatientProfileRepository } from './models/patient-profile-repository.js';
import { MedicalRecordRepository } from './models/medical-record-repository.js';
import { ConsentRepository } from './models/consent-repository.js';
import { PrescriptionRepository } from './models/prescription-repository.js';
import { AuditRepository } from './models/audit-repository.js';
import { EmergencyAccessRepository } from './models/emergency-access-repository.js';
import { AuthService } from './services/auth-service.js';
import { PatientProfileService } from './services/patient-profile-service.js';
import { MedicalRecordService } from './services/medical-record-service.js';
import { FileEncryptionService } from './encryption/file-encryption-service.js';
import { WalletService } from './services/wallet-service.js';
import { ConsentService } from './services/consent-service.js';
import { PrescriptionService } from './services/prescription-service.js';
import { AuditService } from './services/audit-service.js';
import { EmergencyAccessService } from './services/emergency-access-service.js';

const config = loadEnv();
const database = createDatabase(config);
const userRepository = new UserRepository(database);
const medicalRecordRepository = new MedicalRecordRepository(database);
const auditRepository = new AuditRepository(database);
const authService = new AuthService({
  userRepository,
  jwtSecret: config.JWT_SECRET,
  jwtExpiresIn: config.JWT_EXPIRES_IN
});
const patientProfileService = new PatientProfileService({
  patientProfileRepository: new PatientProfileRepository(database)
});
const recordRegistryClient = new RecordRegistryClient({
  rpcUrl: config.BLOCKCHAIN_RPC_URL,
  chainId: config.BLOCKCHAIN_CHAIN_ID,
  contractAddress: config.BLOCKCHAIN_CONTRACT_ADDRESS,
  privateKey: config.BLOCKCHAIN_PRIVATE_KEY
});
const auditService = new AuditService({ auditRepository, userRepository, recordRegistryClient });
const consentService = new ConsentService({
  consentRepository: new ConsentRepository(database),
  userRepository,
  recordRegistryClient,
  auditService
});
const medicalRecordService = new MedicalRecordService({
  medicalRecordRepository,
  medicalStorage: createMedicalStorage(config),
  fileEncryptionService: new FileEncryptionService({ masterKey: Buffer.from(config.FILE_ENCRYPTION_KEY, 'base64') }),
  userRepository,
  recordRegistryClient,
  consentService,
  auditService
});
const walletService = new WalletService({ userRepository });
const prescriptionService = new PrescriptionService({
  prescriptionRepository: new PrescriptionRepository(database),
  medicalStorage: createMedicalStorage(config),
  fileEncryptionService: new FileEncryptionService({ masterKey: Buffer.from(config.FILE_ENCRYPTION_KEY, 'base64') }),
  userRepository,
  consentService,
  recordRegistryClient,
  auditService
});
const emergencyAccessService = new EmergencyAccessService({
  emergencyAccessRepository: new EmergencyAccessRepository(database),
  userRepository,
  medicalRecordRepository,
  auditService
});
const app = createApp({ authService, patientProfileService, medicalRecordService, walletService, consentService, prescriptionService, emergencyAccessService, auditRepository });
const server = app.listen(config.PORT, () => console.log(`MediVault API listening on port ${config.PORT}`));

async function shutdown() {
  server.close(async () => {
    await database.close();
    process.exit(0);
  });
}
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
