import { Contract, JsonRpcProvider, Wallet, keccak256, toUtf8Bytes } from 'ethers';

const REGISTRY_ABI = [
  'function registerRecord(bytes32 recordId, bytes32 contentHash, address patient)',
  'function verifyRecord(bytes32 recordId, bytes32 contentHash) view returns (bool)',
  'function grantAccess(address patient, address doctor, uint256 expiresAt)',
  'function revokeAccess(address patient, address doctor)',
  'function hasAccess(address patient, address doctor) view returns (bool)',
  'function recordAuditEvent(bytes32 eventId, bytes32 eventType, address subject, address actor, uint256 expiresAt)'
];

export class RecordRegistryClient {
  constructor({ rpcUrl, chainId, contractAddress, privateKey }) {
    this.provider = new JsonRpcProvider(rpcUrl, chainId, { staticNetwork: true });
    this.contract = new Contract(contractAddress, REGISTRY_ABI, new Wallet(privateKey, this.provider));
  }

  deriveRecordId(recordId) {
    return keccak256(toUtf8Bytes(`medivault-record:${recordId}`));
  }

  async registerRecord({ recordId, contentSha256, patientAddress }) {
    const blockchainRecordId = this.deriveRecordId(recordId);
    const transaction = await this.contract.registerRecord(blockchainRecordId, `0x${contentSha256}`, patientAddress);
    const receipt = await transaction.wait(1);
    return { blockchainRecordId, transactionHash: receipt.hash, registeredAt: new Date() };
  }

  async verifyRecord({ recordId, contentSha256 }) {
    return this.contract.verifyRecord(this.deriveRecordId(recordId), `0x${contentSha256}`);
  }

  async grantAccess({ patientAddress, doctorAddress, expiresAt }) {
    const transaction = await this.contract.grantAccess(patientAddress, doctorAddress, Math.floor(expiresAt.getTime() / 1000));
    return (await transaction.wait(1)).hash;
  }

  async revokeAccess({ patientAddress, doctorAddress }) {
    const transaction = await this.contract.revokeAccess(patientAddress, doctorAddress);
    return (await transaction.wait(1)).hash;
  }

  async hasAccess({ patientAddress, doctorAddress }) {
    return this.contract.hasAccess(patientAddress, doctorAddress);
  }

  async recordAuditEvent({ eventId, eventType, subjectAddress, actorAddress, expiresAt = null }) {
    const transaction = await this.contract.recordAuditEvent(
      keccak256(toUtf8Bytes(`medivault-audit:${eventId}`)),
      keccak256(toUtf8Bytes(eventType)),
      subjectAddress,
      actorAddress,
      expiresAt ? Math.floor(expiresAt.getTime() / 1000) : 0
    );
    return (await transaction.wait(1)).hash;
  }
}
