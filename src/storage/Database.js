const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required. Add your PostgreSQL connection string to the environment.');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  connectionTimeoutMillis: 10_000
});

pool.on('error', error => {
  console.error('Unexpected error from an idle PostgreSQL connection:', error);
});

async function initializeDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      avatar TEXT NOT NULL DEFAULT '👤',
      language TEXT NOT NULL DEFAULT 'uk' CHECK (language IN ('uk', 'en')),
      theme TEXT NOT NULL DEFAULT 'neon' CHECK (theme IN ('neon', 'cyberpunk', 'light')),
      legacy_imported BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS boards (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      position INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in-progress', 'done')),
      priority TEXT NOT NULL DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High')),
      due_date TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at BIGINT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS boards_owner_position ON boards(owner_id, position);
    CREATE INDEX IF NOT EXISTS tasks_board_created ON tasks(board_id, created_at);
    CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
  `);
}

async function transaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { pool, initializeDatabase, transaction };
