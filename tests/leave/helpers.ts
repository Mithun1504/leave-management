import type Database from 'better-sqlite3';
import jwt from 'jsonwebtoken';
import { createApp } from '../../src/app';
import { openDatabase } from '../../src/db/database';

const TEST_SECRET = 'leave-module-test-secret';

export interface LeaveTestContext {
  db: Database.Database;
  app: ReturnType<typeof createApp>;
  ids: { admin: number; manager: number; employee: number; otherManager: number; otherEmployee: number };
  tokens: { admin: string; manager: string; employee: string; otherManager: string; otherEmployee: string };
  close(): void;
}

export function createLeaveTestContext(): LeaveTestContext {
  process.env.JWT_SECRET = TEST_SECRET;
  const db = openDatabase(':memory:');
  const admin = Number(db.prepare(`
    INSERT INTO users (name, email, password_hash, role)
    VALUES ('Admin', 'admin@example.test', 'hash', 'admin')
  `).run().lastInsertRowid);
  const manager = Number(db.prepare(`
    INSERT INTO users (name, email, password_hash, role)
    VALUES ('Manager', 'manager@example.test', 'hash', 'manager')
  `).run().lastInsertRowid);
  const employee = Number(db.prepare(`
    INSERT INTO users (name, email, password_hash, role, manager_id)
    VALUES ('Employee', 'employee@example.test', 'hash', 'employee', ?)
  `).run(manager).lastInsertRowid);
  const otherManager = Number(db.prepare(`
    INSERT INTO users (name, email, password_hash, role)
    VALUES ('Other Manager', 'other-manager@example.test', 'hash', 'manager')
  `).run().lastInsertRowid);
  const otherEmployee = Number(db.prepare(`
    INSERT INTO users (name, email, password_hash, role, manager_id)
    VALUES ('Other Employee', 'other-employee@example.test', 'hash', 'employee', ?)
  `).run(otherManager).lastInsertRowid);
  const ids = { admin, manager, employee, otherManager, otherEmployee };
  const tokens = Object.fromEntries(Object.entries(ids).map(([role, id]) => [
    role,
    jwt.sign({}, TEST_SECRET, { subject: String(id) })
  ])) as LeaveTestContext['tokens'];

  return {
    db,
    app: createApp(db),
    ids,
    tokens,
    close() {
      db.close();
      delete process.env.JWT_SECRET;
    }
  };
}
