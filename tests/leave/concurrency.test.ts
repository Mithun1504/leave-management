import request from 'supertest';
import { BalanceService } from '../../src/modules/leave/balance';
import { createLeaveTestContext } from './helpers';

describe('transactional leave concurrency (AC1, AC3, AC4, AC7)', () => {
  let context: ReturnType<typeof createLeaveTestContext>;

  beforeEach(() => { context = createLeaveTestContext(); });
  afterEach(() => context.close());

  it('allows only one of two overlapping concurrent submissions (AC1, AC7)', async () => {
    const submit = (leaveType: string) => request(context.app)
      .post('/api/leave/requests')
      .set('Authorization', `Bearer ${context.tokens.employee}`)
      .send({ leaveType, startDate: '2999-01-04', endDate: '2999-01-08', reason: leaveType });

    const results = await Promise.all([submit('Casual'), submit('Sick')]);

    expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
    expect((context.db.prepare('SELECT COUNT(*) AS count FROM leave_requests').get() as { count: number }).count)
      .toBe(1);
  });

  it('serializes approvals so concurrent requests cannot overdraw a balance (AC4, AC7)', async () => {
    context.db.prepare(`
      INSERT INTO leave_requests (employee_id, leave_type, start_date, end_date, reason, status)
      VALUES (?, 'Casual', '2999-01-04', '2999-01-18', 'Eleven days', 'Approved')
    `).run(context.ids.employee);
    const firstId = Number(context.db.prepare(`
      INSERT INTO leave_requests (employee_id, leave_type, start_date, end_date, reason)
      VALUES (?, 'Casual', '2999-01-21', '2999-01-21', 'First remaining day')
    `).run(context.ids.employee).lastInsertRowid);
    const secondId = Number(context.db.prepare(`
      INSERT INTO leave_requests (employee_id, leave_type, start_date, end_date, reason)
      VALUES (?, 'Casual', '2999-01-22', '2999-01-22', 'Competing remaining day')
    `).run(context.ids.employee).lastInsertRowid);
    const decide = (id: number) => request(context.app)
      .post(`/api/leave/requests/${id}/decision`)
      .set('Authorization', `Bearer ${context.tokens.manager}`)
      .send({ decision: 'Approved' });

    const results = await Promise.all([decide(firstId), decide(secondId)]);
    const statuses = context.db.prepare(`
      SELECT status FROM leave_requests WHERE id IN (?, ?) ORDER BY id
    `).all(firstId, secondId) as Array<{ status: string }>;
    const balance = new BalanceService(context.db).balancesForYear(context.ids.employee, 2999)
      .balances.find((item) => item.leaveType === 'Casual');

    expect(results.map((result) => result.status).sort()).toEqual([200, 422]);
    expect(statuses.map((row) => row.status).sort()).toEqual(['Approved', 'Pending']);
    expect(balance).toMatchObject({ usedDays: 12, remainingDays: 0 });
  });

  it('allows only one decision when two managers decide the same request concurrently (AC3)', async () => {
    const id = Number(context.db.prepare(`
      INSERT INTO leave_requests (employee_id, leave_type, start_date, end_date, reason)
      VALUES (?, 'Sick', '2999-01-04', '2999-01-04', 'Competing decisions')
    `).run(context.ids.employee).lastInsertRowid);
    const decide = (decision: 'Approved' | 'Rejected') => request(context.app)
      .post(`/api/leave/requests/${id}/decision`)
      .set('Authorization', `Bearer ${context.tokens.manager}`)
      .send({ decision });

    const results = await Promise.all([decide('Approved'), decide('Rejected')]);
    const finalStatus = (context.db.prepare('SELECT status FROM leave_requests WHERE id = ?').get(id) as { status: string }).status;

    expect(results.map((result) => result.status).sort()).toEqual([200, 409]);
    expect(['Approved', 'Rejected']).toContain(finalStatus);
  });
});
