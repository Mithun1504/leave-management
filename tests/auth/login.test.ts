import jwt from 'jsonwebtoken';
import request from 'supertest';
import { createApp } from '../../src/app';
import { openDatabase, initializeDatabase } from '../../src/db/database';
import type Database from 'better-sqlite3';

describe('login and token issuance (AC4, AC5)', () => {
  let db: Database.Database;
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret';
    process.env.JWT_EXPIRES_IN = '1h';
    db = openDatabase(':memory:');
    initializeDatabase(db, {
      name: 'Admin', email: 'admin@example.test', password: 'valid-password'
    });
    app = createApp(db);
  });

  afterEach(() => {
    db.close();
    delete process.env.JWT_SECRET;
    delete process.env.JWT_EXPIRES_IN;
  });

  it('issues an expiring access token for valid credentials (AC4)', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@example.test', password: 'valid-password' });

    expect(response.status).toBe(200);
    expect(typeof response.body.accessToken).toBe('string');
    const payload = jwt.verify(response.body.accessToken, 'test-secret');
    expect(typeof payload).toBe('object');
    expect((payload as jwt.JwtPayload).sub).toBe('1');
    expect((payload as jwt.JwtPayload).exp).toEqual(expect.any(Number));
  });

  it('returns an identical 401 response for unknown email and incorrect password (AC5)', async () => {
    const unknown = await request(app)
      .post('/api/auth/login')
      .send({ email: 'unknown@example.test', password: 'valid-password' });
    const incorrect = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@example.test', password: 'incorrect-password' });

    expect(unknown.status).toBe(401);
    expect(unknown.body).toEqual(incorrect.body);
    expect(unknown.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('does not return a token for an inactive user (AC5)', async () => {
    db.prepare('UPDATE users SET is_active = 0 WHERE email = ?').run('admin@example.test');
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@example.test', password: 'valid-password' });

    expect(response.status).toBe(401);
    expect(response.body.accessToken).toBeUndefined();
  });
});
