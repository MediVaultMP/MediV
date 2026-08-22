import pg from 'pg';

export function createDatabase(config) {
  const pool = new pg.Pool({
    connectionString: config.DATABASE_URL,
    ssl: config.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined
  });

  return {
    query: (text, values) => pool.query(text, values),
    close: () => pool.end()
  };
}
