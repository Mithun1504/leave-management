import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { createApp } from '../../src/app';
import { initializeDatabase } from '../../src/db/database';
import type Database from 'better-sqlite3';
import { openDatabase } from '../../src/db/database';

describe('admin user creation (AC2, AC3, AC8)', () => {
  let db: Database.Database;
  let app: ReturnType<typeof createApp>;
  let adminToken: string;
  let managerId: number;
  let managerToken: string;
  let employeeToken: string;
  let employeeId: number;

  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret';
    db = openDatabase(':memory:');
    const adminId = initializeDatabase(db, {
      name: 'Admin', email: 'admin@example.test', password: 'admin-password'
    });
    managerId = Number(db.prepare(`
      INSERT INTO users (name, email, password_hash, role, is_active)
      VALUES (?, ?, ?, 'manager', 1)
    `).run('Manager', 'manager@example.test', bcrypt.hashSync('manager-password', 10)).lastInsertRowid);
    employeeId = Number(db.prepare(`
      INSERT INTO users (name, email, password_hash, role, manager_id, is_active)
      VALUES (?, ?, ?, 'employee', ?, 1)
    `).run('Employee', 'employee@example.test', bcrypt.hashSync('employee-password', 10), managerId).lastInsertRowid);
    adminToken = jwt.sign({}, process.env.JWT_SECRET, { subject: String(adminId) });
    managerToken = jwt.sign({}, process.env.JWT_SECRET, { subject: String(managerId) });
    employeeToken = jwt.sign({}, process.env.JWT_SECRET, { subject: String(employeeId) });
    app = createApp(db);
  });

  afterEach(() => {
    db.close();
    delete process.env.JWT_SECRET;
  });

  it('creates an account with the requested attributes and stores only a password hash (AC2)', async () => {
    const response = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'New Employee', email: 'new@example.test', password: 'new-password', role: 'employee', managerId });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      name: 'New Employee', email: 'new@example.test', role: 'employee', managerId
    });
    const stored = db.prepare('SELECT password_hash, manager_id FROM users WHERE id = ?').get(response.body.id) as {
      password_hash: string; manager_id: number;
    };
    expect(bcrypt.compareSync('new-password', stored.password_hash)).toBe(true);
    expect(stored.password_hash).not.toBe('new-password');
    expect(stored.manager_id).toBe(managerId);
  });

  it('creates managers without a manager assignment (AC2)', async () => {
    const response = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Another Manager', email: 'another-manager@example.test', password: 'secret', role: 'manager' });

    expect(response.status).toBe(201);
    expect(response.body.managerId).toBeNull();
  });

  it('denies user creation to non-admins (AC3)', async () => {
    const response = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ name: 'Blocked', email: 'blocked@example.test', password: 'secret', role: 'manager' });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');

    const managerResponse = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ name: 'Blocked Manager', email: 'blocked-manager@example.test', password: 'secret', role: 'manager' });
    expect(managerResponse.status).toBe(403);
  });

  it('rejects an assignment to an existing non-manager account (AC8)', async () => {
    const response = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'New Employee', email: 'new@example.test', password: 'secret', role: 'employee', managerId: employeeId });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('INVALID_MANAGER');
  });

  it('rejects duplicate email and missing required account fields (AC2)', async () => {
    const duplicate = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Duplicate', email: 'manager@example.test', password: 'secret', role: 'manager' });
    const missing = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: ' ', email: 'missing@example.test', password: 'secret', role: 'manager' });

    expect(duplicate.status).toBe(409);
    expect(missing.status).toBe(400);
  });
});
