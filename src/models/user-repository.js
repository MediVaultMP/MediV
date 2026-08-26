export class UserRepository {
  constructor(database) {
    this.database = database;
  }

  async findByEmail(email) {
    const result = await this.database.query(
      'SELECT id, email, password_hash, role, status, created_at FROM users WHERE email = $1',
      [email]
    );
    return result.rows[0] ?? null;
  }

  async findById(id) {
    const result = await this.database.query(
      'SELECT id, email, role, status, blockchain_address FROM users WHERE id = $1',
      [id]
    );
    return result.rows[0] ?? null;
  }

  async updateBlockchainAddress(id, blockchainAddress) {
    const result = await this.database.query(
      'UPDATE users SET blockchain_address = $2, updated_at = NOW() WHERE id = $1 RETURNING id, blockchain_address',
      [id, blockchainAddress]
    );
    return result.rows[0];
  }

  async create({ email, passwordHash, role, status = 'active', blockchainAddress }) {
    const result = await this.database.query(
      `INSERT INTO users (email, password_hash, role, status, blockchain_address)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, role, status, created_at, blockchain_address`,
      [email, passwordHash, role, status, blockchainAddress]
    );
    return result.rows[0];
  }

  async listPending() {
    const result = await this.database.query(
      `SELECT id, email, role, status, created_at FROM users
       WHERE status = 'pending' ORDER BY created_at ASC`
    );
    return result.rows;
  }

  async listAll({ limit = 200 } = {}) {
    const result = await this.database.query(
      `SELECT id, email, role, status, created_at FROM users
       ORDER BY created_at DESC LIMIT $1`,
      [limit]
    );
    return result.rows;
  }

  async setStatus(id, status) {
    const result = await this.database.query(
      `UPDATE users SET status = $2, updated_at = NOW() WHERE id = $1
       RETURNING id, email, role, status`,
      [id, status]
    );
    return result.rows[0] ?? null;
  }
}