import type Database from 'better-sqlite3';
import { BalanceService, countWeekdays, weekdaysByYear } from '../../src/modules/leave/balance';
import { openDatabase } from '../../src/db/database';

describe('leave balance calculations (AC2, AC4, AC7)', () => {
  let db: Database.Database;
  let employeeId: number;
  let balances: BalanceService;

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
    balances = new BalanceService(db);
  });

  afterEach(() => db.close());

  it('returns the annual allocations, including for a new employee during the year (AC2)', () => {
    const year = new Date().getUTCFullYear();
    const result = balances.balancesForYear(employeeId, year);
    expect(result).toEqual({
      year,
      balances: [
        { leaveType: 'Casual', allocatedDays: 12, usedDays: 0, remainingDays: 12 },
        { leaveType: 'Sick', allocatedDays: 10, usedDays: 0, remainingDays: 10 },
        { leaveType: 'Earned', allocatedDays: 15, usedDays: 0, remainingDays: 15 }
      ]
    });
  });

  it('counts inclusive weekdays and splits ranges across calendar years (AC2, AC4)', () => {
    expect(countWeekdays('2026-06-01', '2026-06-05')).toBe(5);
    expect(countWeekdays('2026-06-05', '2026-06-08')).toBe(2);
    expect(weekdaysByYear({ startDate: '2026-12-31', endDate: '2027-01-04' })).toEqual(
      new Map([[2026, 1], [2027, 2]])
    );
  });

  it('deducts only approved weekdays and ignores pending and rejected requests (AC4, AC7)', () => {
    db.prepare(`
      INSERT INTO leave_requests (employee_id, leave_type, start_date, end_date, reason, status)
      VALUES (?, 'Casual', '2026-06-01', '2026-06-02', 'Approved leave', 'Approved')
    `).run(employeeId);
    db.prepare(`
      INSERT INTO leave_requests (employee_id, leave_type, start_date, end_date, reason, status)
      VALUES (?, 'Casual', '2026-06-03', '2026-06-04', 'Pending leave', 'Pending')
    `).run(employeeId);
    db.prepare(`
      INSERT INTO leave_requests (employee_id, leave_type, start_date, end_date, reason, status)
      VALUES (?, 'Sick', '2026-06-05', '2026-06-08', 'Rejected leave', 'Rejected')
    `).run(employeeId);

    const result = balances.balancesForYear(employeeId, 2026);
    expect(result.balances).toEqual([
      { leaveType: 'Casual', allocatedDays: 12, usedDays: 2, remainingDays: 10 },
      { leaveType: 'Sick', allocatedDays: 10, usedDays: 0, remainingDays: 10 },
      { leaveType: 'Earned', allocatedDays: 15, usedDays: 0, remainingDays: 15 }
    ]);
  });
});
