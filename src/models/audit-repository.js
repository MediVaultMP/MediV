export class AuditRepository {
  constructor(database) { this.database = database; }

  async create({ eventType, actorUserId, subjectUserId, resourceType, resourceId, metadata, blockchainTxHash }) {
    const result = await this.database.query(
      `INSERT INTO audit_events (event_type, actor_user_id, subject_user_id, resource_type, resource_id, metadata, blockchain_tx_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [eventType, actorUserId, subjectUserId, resourceType, resourceId, JSON.stringify(metadata ?? {}), blockchainTxHash ?? null]
    );
    return result.rows[0];
  }

  async listForPatient(patientUserId) {
    const result = await this.database.query(
      `SELECT id, event_type, actor_user_id, subject_user_id, resource_type, resource_id, metadata, created_at
       FROM audit_events WHERE subject_user_id = $1 ORDER BY created_at DESC LIMIT 200`,
      [patientUserId]
    );
    return result.rows;
  }

  async listAll({ limit = 200 } = {}) {
    const result = await this.database.query(
      `SELECT id, event_type, actor_user_id, subject_user_id, resource_type, resource_id, metadata, blockchain_tx_hash, created_at
       FROM audit_events ORDER BY created_at DESC LIMIT $1`,
      [limit]
    );
    return result.rows;
  }
}
