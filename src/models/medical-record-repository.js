export class MedicalRecordRepository {
  constructor(database) {
    this.database = database;
  }

  async create({ patientUserId, uploadedByUserId, storageKey, originalFilename, contentType, sizeBytes, title, category, contentSha256, encryption }) {
    const result = await this.database.query(
      `INSERT INTO medical_records (
        patient_user_id, uploaded_by_user_id, storage_key, original_filename, content_type,
        size_bytes, title, category, content_sha256, encryption_algorithm, encrypted_data_key, data_key_iv,
        data_key_auth_tag, file_iv, file_auth_tag
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING *`,
      [patientUserId, uploadedByUserId, storageKey, originalFilename, contentType, sizeBytes, title, category, contentSha256,
        encryption.encryptionAlgorithm, encryption.encryptedDataKey, encryption.dataKeyIv,
        encryption.dataKeyAuthTag, encryption.fileIv, encryption.fileAuthTag]
    );
    return result.rows[0];
  }

  async findByIdForPatient(recordId, patientUserId) {
    const result = await this.database.query(
      'SELECT * FROM medical_records WHERE id = $1 AND patient_user_id = $2',
      [recordId, patientUserId]
    );
    return result.rows[0] ?? null;
  }

  async listForPatient(patientUserId) {
    const result = await this.database.query(
      `SELECT id, original_filename, content_type, size_bytes, title, category, blockchain_status, created_at
       FROM medical_records WHERE patient_user_id = $1 ORDER BY created_at DESC`,
      [patientUserId]
    );
    return result.rows;
  }

  async markBlockchainRegistered(recordId, registration) {
    const result = await this.database.query(
      `UPDATE medical_records SET blockchain_status = 'registered', blockchain_record_id = $2,
       blockchain_tx_hash = $3, blockchain_registered_at = $4 WHERE id = $1 RETURNING *`,
      [recordId, registration.blockchainRecordId, registration.transactionHash, registration.registeredAt]
    );
    return result.rows[0];
  }

  async markBlockchainFailed(recordId) {
    await this.database.query("UPDATE medical_records SET blockchain_status = 'failed' WHERE id = $1", [recordId]);
  }
}
