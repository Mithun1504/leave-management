import request from 'supertest';
import { createApp } from '../src/app';
import { openDatabase } from '../src/db/database';

describe('static frontend', () => {
  it('serves the login page at GET /', async () => {
    const db = openDatabase(':memory:');
    try {
      const response = await request(createApp(db)).get('/');
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/text\/html/);
      expect(response.text).toContain('id="login-form"');
      expect(response.text).toContain('Sign in');
    } finally {
      db.close();
    }
  });
});
