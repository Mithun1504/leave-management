import type Database from 'better-sqlite3';
import { openDatabase } from '../../src/db/database';

describe('leave request persistence (AC1)', () => {
  let db: Database.Database;
  let employeeId: number;

  beforeEach(() => {
    db = openDatabase(':memory:');
    const managerId = Number(db.prepare(`
      INSERT INTO users (name, email, password_hash, role)
      VALUES ('Manager', 'manager@example.test', 'hash', 'manager')
    `).run().lastInsertRowid);
    employeeId = Number(db.prepare(`
      INSERT INTO users (name, email, password_hash, role, manager_id)
      VALUES ('Employee', 'employee@example.test', 'hash', 'employee', ?)
    `).run(managerId).lastInsertRowid);
  });

  afterEach(() => db.close());

  it('persists all request fields with initial Pending status', () => {
    const result = db.prepare(`
      INSERT INTO leave_requests (employee_id, leave_type, start_date, end_date, reason)
      VALUES (?, 'Casual', '2999-01-04', '2999-01-05', 'Personal leave')
    `).run(employeeId);
    const request = db.prepare('SELECT * FROM leave_requests WHERE id = ?').get(result.lastInsertRowid) as {
      employee_id: number;
      leave_type: string;
      start_date: string;
      end_date: string;
      reason: string;
      status: string;
    };

    expect(request).toMatchObject({
      employee_id: employeeId,
      leave_type: 'Casual',
      start_date: '2999-01-04',
      end_date: '2999-01-05',
      reason: 'Personal leave',
      status: 'Pending'
    });
  });

  it('enforces supported types, statuses, required reason, date ordering, and employee role', () => {
    expect(() => db.prepare(`
      INSERT INTO leave_requests (employee_id, leave_type, start_date, end_date, reason)
      VALUES (?, 'Vacation', '2999-01-04', '2999-01-05', 'Reason')
    `).run(employeeId)).toThrow();
    expect(() => db.prepare(`
      INSERT INTO leave_requests (employee_id, leave_type, start_date, end_date, reason)
      VALUES (?, 'Casual', '2999-01-05', '2999-01-04', 'Reason')
    `).run(employeeId)).toThrow();
    expect(() => db.prepare(`
      INSERT INTO leave_requests (employee_id, leave_type, start_date, end_date, reason)
      VALUES (?, 'Casual', '2999-01-04', '2999-01-05', '  ')
    `).run(employeeId)).toThrow();

    const managerId = db.prepare("SELECT id FROM users WHERE role = 'manager'").get() as { id: number };
    expect(() => db.prepare(`
      INSERT INTO leave_requests (employee_id, leave_type, start_date, end_date, reason, status)
      VALUES (?, 'Casual', '2999-01-04', '2999-01-05', 'Reason', 'Cancelled')
    `).run(employeeId)).toThrow();
    expect(() => db.prepare(`
      INSERT INTO leave_requests (employee_id, leave_type, start_date, end_date, reason)
      VALUES (?, 'Casual', '2999-01-04', '2999-01-05', 'Reason')
    `).run(managerId.id)).toThrow();
  });
});
