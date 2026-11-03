import bcrypt from 'bcryptjs';
import type Database from 'better-sqlite3';
import { HttpError } from '../../shared/http';

export type UserRole = 'admin' | 'manager' | 'employee';

export interface UserRecord {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  managerId: number | null;
  isActive: boolean;
}

export interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  role: string;
  managerId?: unknown;
}

export function findUserById(db: Database.Database, id: number): (UserRecord & { passwordHash: string }) | undefined {
  type UserRow = Omit<UserRecord, 'isActive'> & { passwordHash: string; isActive: number };
  const row = db.prepare(`
    SELECT id, name, email, password_hash AS passwordHash, role,
      manager_id AS managerId, is_active AS isActive
    FROM users WHERE id = ?
  `).get(id) as UserRow | undefined;
  return row ? { ...row, isActive: Boolean(row.isActive) } : undefined;
}

export function createUser(db: Database.Database, input: CreateUserInput): UserRecord {
  if (!['admin', 'manager', 'employee'].includes(input.role)) {
    throw new HttpError(422, 'INVALID_ROLE', 'Role must be admin, manager, or employee');
  }

  let managerId: number | null = null;
  if (input.role === 'employee') {
    if (!Number.isSafeInteger(input.managerId) || Number(input.managerId) <= 0) {
      throw new HttpError(422, 'INVALID_MANAGER', 'Employee must have one assigned manager');
    }
    managerId = Number(input.managerId);
    const manager = db.prepare(
      "SELECT id FROM users WHERE id = ? AND role = 'manager'"
    ).get(managerId);
    if (!manager) {
      throw new HttpError(422, 'INVALID_MANAGER', 'Assigned user must have the manager role');
    }
  } else if (input.managerId !== undefined && input.managerId !== null) {
    throw new HttpError(422, 'INVALID_MANAGER', 'Only employees can have an assigned manager');
  }

  const duplicate = db.prepare('SELECT id FROM users WHERE email = ?').get(input.email);
  if (duplicate) {
    throw new HttpError(409, 'EMAIL_CONFLICT', 'Email address is already in use');
  }

  let id: number;
  try {
    const result = db.prepare(`
      INSERT INTO users (name, email, password_hash, role, manager_id, is_active)
      VALUES (?, ?, ?, ?, ?, 1)
    `).run(input.name, input.email, bcrypt.hashSync(input.password, 10), input.role, managerId);
    id = Number(result.lastInsertRowid);
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed: users.email')) {
      throw new HttpError(409, 'EMAIL_CONFLICT', 'Email address is already in use');
    }
    throw error;
  }

  return {
    id,
    name: input.name,
    email: input.email,
    role: input.role as UserRole,
    managerId,
    isActive: true
  };
}
