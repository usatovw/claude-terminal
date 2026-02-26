const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

const DATA_DIR = path.join(__dirname, "data");
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, "claude-terminal.db");
const db = new Database(DB_PATH);

// WAL mode for better concurrent read performance
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    login TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL DEFAULT '',
    role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('admin', 'user', 'guest')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
    color_index INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    text TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS attachments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id INTEGER NOT NULL,
    file_path TEXT NOT NULL,
    original_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS cli_providers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    command TEXT NOT NULL,
    resume_command TEXT DEFAULT NULL,
    icon TEXT NOT NULL DEFAULT 'terminal',
    color TEXT NOT NULL DEFAULT '#8b5cf6',
    sort_order INTEGER NOT NULL DEFAULT 100,
    is_builtin INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Seed admin user from env vars on first run
function seedAdmin() {
  const login = process.env.LOGIN_USERNAME;
  const passwordHash = process.env.PASSWORD_HASH;

  if (!login || !passwordHash) {
    console.log("[db] LOGIN_USERNAME or PASSWORD_HASH not set, skipping admin seed");
    return;
  }

  const existing = db.prepare("SELECT id FROM users WHERE login = ?").get(login);
  if (existing) {
    return;
  }

  // Assign color_index 0 to admin
  db.prepare(
    `INSERT INTO users (login, password_hash, first_name, last_name, role, status, color_index)
     VALUES (?, ?, ?, '', 'admin', 'approved', 0)`
  ).run(login, passwordHash, "Admin");

  console.log(`[db] Admin user "${login}" seeded`);
}

seedAdmin();

// Seed built-in CLI providers
function seedProviders() {
  const builtins = [
    { slug: "terminal", name: "Terminal", command: "/bin/bash", resume_command: null, icon: "terminal", color: "#52525b", sort_order: 1 },
    { slug: "claude", name: "Claude", command: "/usr/bin/claude", resume_command: "/usr/bin/claude --continue", icon: "claude", color: "#d4a574", sort_order: 2 },
  ];

  const insert = db.prepare(
    `INSERT OR IGNORE INTO cli_providers (slug, name, command, resume_command, icon, color, sort_order, is_builtin)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1)`
  );

  for (const p of builtins) {
    insert.run(p.slug, p.name, p.command, p.resume_command, p.icon, p.color, p.sort_order);
  }
}

seedProviders();

module.exports = db;
