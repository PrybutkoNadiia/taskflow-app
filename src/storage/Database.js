const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const databasePath = process.env.DATABASE_PATH || path.join(__dirname, '../../data/taskflow.sqlite');
fs.mkdirSync(path.dirname(databasePath), { recursive: true });

const db = new Database(databasePath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    avatar TEXT NOT NULL DEFAULT '👤',
    language TEXT NOT NULL DEFAULT 'uk' CHECK (language IN ('uk', 'en')),
    theme TEXT NOT NULL DEFAULT 'neon' CHECK (theme IN ('neon', 'cyberpunk', 'light')),
    legacy_imported INTEGER NOT NULL DEFAULT 0,
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
    expires_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS boards_owner_position ON boards(owner_id, position);
  CREATE INDEX IF NOT EXISTS tasks_board_created ON tasks(board_id, created_at);
  CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
`);

module.exports = db;
