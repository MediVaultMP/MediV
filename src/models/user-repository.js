export class UserRepository {
  constructor(database) {
    this.database = database;
  }

  async findByEmail(email) {
    const result = await this.database.query(
      'SELECT id, email, password_hash, role, created_at FROM users WHERE email = $1',
      [email]
    );
    return result.rows[0] ?? null;
  }

  async findById(id) {
    const result = await this.database.query(
      'SELECT id, email, role, blockchain_address FROM users WHERE id = $1',
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

  async create({ email, passwordHash, role }) {
    const result = await this.database.query(
      `INSERT INTO users (email, password_hash, role)
       VALUES ($1, $2, $3)
       RETURNING id, email, role, created_at`,
      [email, passwordHash, role]
    );
    return result.rows[0];
  }
}
