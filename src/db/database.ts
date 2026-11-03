import bcrypt from 'bcryptjs';
import Database from 'better-sqlite3';

export interface BootstrapAdminConfig {
  name: string;
  email: string;
  password: string;
}

const schema = `
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL CHECK (length(trim(name)) > 0),
    email TEXT NOT NULL UNIQUE CHECK (length(trim(email)) > 0),
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'employee')),
    manager_id INTEGER REFERENCES users(id),
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    is_bootstrap INTEGER NOT NULL DEFAULT 0 CHECK (is_bootstrap IN (0, 1)),
    CHECK (
      (role = 'employee' AND manager_id IS NOT NULL) OR
      (role IN ('admin', 'manager') AND manager_id IS NULL)
    )
  );
  CREATE UNIQUE INDEX IF NOT EXISTS one_bootstrap_admin
    ON users(is_bootstrap) WHERE is_bootstrap = 1;
`;

export function openDatabase(path = process.env.DB_PATH ?? ':memory:'): Database.Database {
  const db = new Database(path);
  db.pragma('foreign_keys = ON');
  db.exec(schema);
  return db;
}

function bootstrapConfigFromEnvironment(): BootstrapAdminConfig {
  return {
    name: process.env.BOOTSTRAP_ADMIN_NAME ?? '',
    email: process.env.BOOTSTRAP_ADMIN_EMAIL ?? '',
    password: process.env.BOOTSTRAP_ADMIN_PASSWORD ?? ''
  };
}

export function initializeDatabase(
  db: Database.Database,
  bootstrapConfig?: BootstrapAdminConfig
): number {
  db.pragma('foreign_keys = ON');
  db.exec(schema);

  const existing = db.prepare(
    'SELECT id FROM users WHERE is_bootstrap = 1'
  ).get() as { id: number } | undefined;
  if (existing) return existing.id;

  const config = bootstrapConfig ?? bootstrapConfigFromEnvironment();
  if (!config.name.trim() || !config.email.trim() || config.password.length === 0) {
    throw new Error('Bootstrap admin name, email, and password must be configured');
  }

  const result = db.prepare(`
    INSERT INTO users (name, email, password_hash, role, manager_id, is_active, is_bootstrap)
    VALUES (?, ?, ?, 'admin', NULL, 1, 1)
  `).run(config.name, config.email, bcrypt.hashSync(config.password, 10));

  return Number(result.lastInsertRowid);
}
