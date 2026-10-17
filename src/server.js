import { createApp } from './app.js';
import { createDatabase } from './config/database.js';
import { createMedicalStorage } from './config/storage.js';
import { RecordRegistryClient } from './blockchain/record-registry-client.js';
import { MockRecordRegistryClient } from './blockchain/mock-record-registry-client.js';
import { loadEnv } from './config/env.js';

import { UserRepository } from './models/user-repository.js';
import { PatientProfileRepository } from './models/patient-profile-repository.js';
import { MedicalRecordRepository } from './models/medical-record-repository.js';
import { ConsentRepository } from './models/consent-repository.js';
import { PrescriptionRepository } from './models/prescription-repository.js';
import { AuditRepository } from './models/audit-repository.js';
import { EmergencyAccessRepository } from './models/emergency-access-repository.js';
import { RecordAccessRequestRepository } from './models/record-access-request-repository.js';

import { AuthService } from './services/auth-service.js';
import { PatientProfileService } from './services/patient-profile-service.js';
import { MedicalRecordService } from './services/medical-record-service.js';
import { FileEncryptionService } from './encryption/file-encryption-service.js';
import { WalletService } from './services/wallet-service.js';
import { ConsentService } from './services/consent-service.js';
import { PrescriptionService } from './services/prescription-service.js';
import { AuditService } from './services/audit-service.js';
import { EmergencyAccessService } from './services/emergency-access-service.js';
import { AdminService } from './services/admin-service.js';

const config = loadEnv();
const database = createDatabase(config);

// Repositories
const userRepository = new UserRepository(database);
const patientProfileRepository = new PatientProfileRepository(database);
const medicalRecordRepository = new MedicalRecordRepository(database);
const auditRepository = new AuditRepository(database);
const recordAccessRequestRepository =
  new RecordAccessRequestRepository(database);

// Authentication
const authService = new AuthService({
  userRepository,
  jwtSecret: config.JWT_SECRET,
  jwtExpiresIn: config.JWT_EXPIRES_IN
});

// Patient profiles
const patientProfileService = new PatientProfileService({
  patientProfileRepository
});

// Blockchain configuration
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const useMockChain =
  config.BLOCKCHAIN_CONTRACT_ADDRESS === ZERO_ADDRESS;

const recordRegistryClient = useMockChain
  ? new MockRecordRegistryClient()
  : new RecordRegistryClient({
      rpcUrl: config.BLOCKCHAIN_RPC_URL,
      chainId: config.BLOCKCHAIN_CHAIN_ID,
      contractAddress: config.BLOCKCHAIN_CONTRACT_ADDRESS,
      privateKey: config.BLOCKCHAIN_PRIVATE_KEY
    });

if (useMockChain) {
  console.log(
    'WARNING: BLOCKCHAIN_CONTRACT_ADDRESS is the zero address. ' +
    'Using MockRecordRegistryClient; no real blockchain calls are made.'
  );
}

// Audit service
const auditService = new AuditService({
  auditRepository,
  userRepository,
  recordRegistryClient
});

// Consent service
const consentService = new ConsentService({
  consentRepository: new ConsentRepository(database),
  userRepository,
  recordRegistryClient,
  auditService
});

// File encryption
const fileEncryptionService = new FileEncryptionService({
  masterKey: Buffer.from(config.FILE_ENCRYPTION_KEY, 'base64')
});

// Medical records
const medicalRecordService = new MedicalRecordService({
  medicalRecordRepository,
  recordAccessRequestRepository,
  medicalStorage: createMedicalStorage(config),
  fileEncryptionService,
  userRepository,
  recordRegistryClient,
  consentService,
  auditService
});

// Wallets
const walletService = new WalletService({
  userRepository
});

// Prescriptions
const prescriptionService = new PrescriptionService({
  prescriptionRepository: new PrescriptionRepository(database),
  medicalStorage: createMedicalStorage(config),
  fileEncryptionService,
  userRepository,
  consentService,
  recordRegistryClient,
  auditService
});

// Emergency access
const emergencyAccessService = new EmergencyAccessService({
  emergencyAccessRepository: new EmergencyAccessRepository(database),
  userRepository,
  medicalRecordRepository,
  auditService
});

// Administration
const adminService = new AdminService({
  userRepository,
  auditRepository,
  auditService
});

// Express application
const app = createApp({
  authService,
  patientProfileService,
  medicalRecordService,
  walletService,
  consentService,
  prescriptionService,
  emergencyAccessService,
  auditRepository,
  adminService
});

// Start server
const server = app.listen(config.PORT, () => {
  console.log(`MediVault API listening on port ${config.PORT}`);
});

// Graceful shutdown
async function shutdown() {
  console.log('Shutting down MediVault API...');

  server.close(async () => {
    try {
      await database.close();
      process.exit(0);
    } catch (error) {
      console.error('Error during shutdown:', error);
      process.exit(1);
    }
  });
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
