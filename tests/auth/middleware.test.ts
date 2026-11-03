import jwt from 'jsonwebtoken';
import request from 'supertest';
import type Database from 'better-sqlite3';
import { createApp } from '../../src/app';
import { initializeDatabase, openDatabase } from '../../src/db/database';

describe('authentication and current role middleware (AC6, AC7, AC9)', () => {
  let db: Database.Database;
  let app: ReturnType<typeof createApp>;
  let adminId: number;
  let managerId: number;
  let employeeId: number;

  const tokenFor = (id: number, expiresIn?: number) => jwt.sign(
    {}, 'middleware-test-secret',
    expiresIn === undefined
      ? { subject: String(id) }
      : { subject: String(id), expiresIn }
  );

  beforeEach(() => {
    process.env.JWT_SECRET = 'middleware-test-secret';
    db = openDatabase(':memory:');
    adminId = initializeDatabase(db, {
      name: 'Admin', email: 'admin@example.test', password: 'admin-password'
    });
    managerId = Number(db.prepare(`
      INSERT INTO users (name, email, password_hash, role)
      VALUES ('Manager', 'manager@example.test', 'hash', 'manager')
    `).run().lastInsertRowid);
    employeeId = Number(db.prepare(`
      INSERT INTO users (name, email, password_hash, role, manager_id)
      VALUES ('Employee', 'employee@example.test', 'hash', 'employee', ?)
    `).run(managerId).lastInsertRowid);
    app = createApp(db);
  });

  afterEach(() => {
    db.close();
    delete process.env.JWT_SECRET;
  });

  it('requires a valid token for every API endpoint except login (AC6)', async () => {
    const missing = await request(app).get('/api/not-a-route');
    const malformed = await request(app)
      .get('/api/not-a-route')
      .set('Authorization', 'Bearer malformed');
    const malformedBodyWithoutToken = await request(app)
      .post('/api/users')
      .set('Content-Type', 'application/json')
      .send('{broken');
    const validUnknownEndpoint = await request(app)
      .get('/api/not-a-route')
      .set('Authorization', `Bearer ${tokenFor(adminId)}`);

    expect(missing.status).toBe(401);
    expect(malformed.status).toBe(401);
    expect(malformedBodyWithoutToken.status).toBe(401);
    expect(validUnknownEndpoint.status).toBe(404);
    expect(missing.body.error.code).toBe('UNAUTHORIZED');
  });

  it('uses the current role after a role change while the token is active (AC7, AC9)', async () => {
    const adminToken = tokenFor(adminId);
    db.prepare("UPDATE users SET role = 'manager' WHERE id = ?").run(adminId);

    const response = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Denied', email: 'denied@example.test', password: 'secret', role: 'manager' });

    expect(response.status).toBe(403);
  });

  it('denies expired tokens and tokens for inactive or removed users (AC9)', async () => {
    const expired = await request(app)
      .get('/api/not-a-route')
      .set('Authorization', `Bearer ${tokenFor(adminId, -1)}`);

    const employeeToken = tokenFor(employeeId);
    db.prepare('UPDATE users SET is_active = 0 WHERE id = ?').run(employeeId);
    const inactive = await request(app)
      .get('/api/not-a-route')
      .set('Authorization', `Bearer ${employeeToken}`);

    const managerToken = tokenFor(managerId);
    db.prepare('DELETE FROM users WHERE id = ?').run(employeeId);
    db.prepare('DELETE FROM users WHERE id = ?').run(managerId);
    const removed = await request(app)
      .get('/api/not-a-route')
      .set('Authorization', `Bearer ${managerToken}`);

    expect(expired.status).toBe(401);
    expect(inactive.status).toBe(401);
    expect(removed.status).toBe(401);
  });
});
