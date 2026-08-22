import crypto from 'node:crypto';

export class AuditService {
  constructor({ auditRepository, userRepository, recordRegistryClient }) {
    this.auditRepository = auditRepository;
    this.userRepository = userRepository;
    this.recordRegistryClient = recordRegistryClient;
  }

  async record({ eventType, actorUserId, subjectUserId, resourceType, resourceId, metadata, expiresAt }) {
    let blockchainTxHash = null;
    const [actor, subject] = await Promise.all([
      actorUserId && this.userRepository.findById(actorUserId),
      subjectUserId && this.userRepository.findById(subjectUserId)
    ]);
    if (actor?.blockchain_address && subject?.blockchain_address && this.recordRegistryClient) {
      try {
        blockchainTxHash = await this.recordRegistryClient.recordAuditEvent({
          eventId: crypto.randomUUID(), eventType, subjectAddress: subject.blockchain_address,
          actorAddress: actor.blockchain_address, expiresAt
        });
      } catch { /* PostgreSQL keeps the audit event if the optional anchor is unavailable. */ }
    }
    return this.auditRepository.create({ eventType, actorUserId, subjectUserId, resourceType, resourceId, metadata, blockchainTxHash });
  }
}
