const { createClient } = require('@libsql/client');
require('dotenv').config();

const turso = createClient({
  url:       process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// Wraps Turso to return [rows] like mysql2 — so all controllers work unchanged
const pool = {
  execute: async (sql, params = []) => {
    const result = await turso.execute({ sql, args: params });
    return [result.rows];
  },
  getConnection: async () => ({
    execute: async (sql, params = []) => {
      const result = await turso.execute({ sql, args: params });
      return [result.rows];
    },
    release: () => {},
  }),
};

async function initDB() {
  try {
    // Test connection first with a simple query
    await turso.execute('SELECT 1');
    console.log('✅ Turso connected');

    // Use batch() to run multiple CREATE TABLE statements together
    await turso.batch([
      {
        sql: `CREATE TABLE IF NOT EXISTS users (
          id            INTEGER PRIMARY KEY,
          first_name    TEXT    NOT NULL,
          last_name     TEXT    DEFAULT '',
          email         TEXT    UNIQUE NOT NULL,
          password_hash TEXT,
          business_name TEXT,
          avatar_url    TEXT,
          google_id     TEXT,
          is_verified   INTEGER DEFAULT 0,
          is_active     INTEGER DEFAULT 1,
          created_at    TEXT    DEFAULT (datetime('now')),
          updated_at    TEXT    DEFAULT (datetime('now'))
        )`,
        args: [],
      },
      {
        sql: `CREATE TABLE IF NOT EXISTS password_reset_tokens (
          id         INTEGER PRIMARY KEY,
          user_id    INTEGER NOT NULL,
          token      TEXT    NOT NULL,
          expires_at TEXT    NOT NULL,
          used       INTEGER DEFAULT 0,
          created_at TEXT    DEFAULT (datetime('now'))
        )`,
        args: [],
      },
      // 👉 NEW: Firms Table added here
      {
        sql: `CREATE TABLE IF NOT EXISTS firms (
          id          TEXT PRIMARY KEY,
          userId      TEXT NOT NULL,
          name        TEXT NOT NULL,
          type        TEXT,
          color       TEXT,
          initial     TEXT,
          firmType    TEXT,
          gstin       TEXT,
          address     TEXT,
          mainMobile  TEXT,
          altMobile   TEXT,
          email       TEXT,
          createdAt   TEXT DEFAULT (datetime('now'))
        )`,
        args: [],
      }
    ], 'write');

    console.log('✅ Tables ready');
  } catch (err) {
    console.error('❌ Turso failed:', err.message);
    console.error('   Check TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in .env');
    process.exit(1);
  }
}

module.exports = { pool, initDB };