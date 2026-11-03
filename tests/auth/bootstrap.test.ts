import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { initializeDatabase } from '../../src/db/database';

describe('bootstrap admin (AC1)', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
  });

  afterEach(() => db.close());

  it('creates one bootstrap admin and preserves it on later initialization', () => {
    const firstId = initializeDatabase(db, {
      name: 'Initial Admin',
      email: 'admin@example.test',
      password: 'secret-one'
    });
    const secondId = initializeDatabase(db, {
      name: 'Replacement Admin',
      email: 'replacement@example.test',
      password: 'secret-two'
    });

    const admins = db.prepare(
      'SELECT id, name, email, password_hash, role, is_bootstrap FROM users WHERE is_bootstrap = 1'
    ).all() as Array<{ id: number; name: string; email: string; password_hash: string; role: string; is_bootstrap: number }>;

    expect(secondId).toBe(firstId);
    expect(admins).toHaveLength(1);
    expect(admins[0]).toMatchObject({
      id: firstId,
      name: 'Initial Admin',
      email: 'admin@example.test',
      role: 'admin',
      is_bootstrap: 1
    });
    expect(bcrypt.compareSync('secret-one', admins[0].password_hash)).toBe(true);
    expect(admins[0].password_hash).not.toBe('secret-one');
  });
});
