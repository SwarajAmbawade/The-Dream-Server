const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');

const databaseFile = process.env.DATABASE_FILE || './data/dream-server.sqlite';

if (databaseFile !== ':memory:') {
  fs.mkdirSync(path.dirname(path.resolve(databaseFile)), { recursive: true });
}

const db = new Database(databaseFile);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL COLLATE NOCASE UNIQUE,
    password_hash TEXT NOT NULL,
    credits INTEGER NOT NULL DEFAULT 500 CHECK (credits >= 0),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS dreams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    story TEXT NOT NULL,
    mood TEXT NOT NULL CHECK (mood IN ('Lucid', 'Peaceful', 'Surreal', 'Recurring', 'Nightmare')),
    author_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    author_name TEXT NOT NULL,
    likes INTEGER NOT NULL DEFAULT 0,
    for_sale INTEGER NOT NULL DEFAULT 0,
    price INTEGER NOT NULL DEFAULT 0 CHECK (price >= 0),
    rent_price INTEGER NOT NULL DEFAULT 0 CHECK (rent_price >= 0),
    ai_origin INTEGER NOT NULL DEFAULT 0,
    image_url TEXT,
    image_credit TEXT,
    image_license TEXT,
    image_source_url TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS resonances (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    dream_id INTEGER NOT NULL REFERENCES dreams(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, dream_id)
  );

  CREATE TABLE IF NOT EXISTS purchases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    buyer_id INTEGER NOT NULL REFERENCES users(id),
    dream_id INTEGER NOT NULL REFERENCES dreams(id),
    price INTEGER NOT NULL CHECK (price >= 0),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (buyer_id, dream_id)
  );

  CREATE TABLE IF NOT EXISTS rentals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    renter_id INTEGER NOT NULL REFERENCES users(id),
    dream_id INTEGER NOT NULL REFERENCES dreams(id),
    price INTEGER NOT NULL CHECK (price >= 0),
    started_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS credit_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN ('demo_topup', 'daily_spin')),
    amount INTEGER NOT NULL,
    details TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS daily_spins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    spin_date TEXT NOT NULL,
    reward INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, spin_date)
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    dream_id INTEGER REFERENCES dreams(id),
    type TEXT NOT NULL CHECK (type IN ('purchase', 'rental', 'welcome_credit')),
    amount INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Add artwork attribution fields to databases created by earlier project versions.
const dreamColumns = new Set(db.prepare('PRAGMA table_info(dreams)').all().map((column) => column.name));
for (const [name, type] of [
  ['image_credit', 'TEXT'],
  ['image_license', 'TEXT'],
  ['image_source_url', 'TEXT'],
]) {
  if (!dreamColumns.has(name)) {
    db.exec(`ALTER TABLE dreams ADD COLUMN ${name} ${type}`);
  }
}

module.exports = db;
