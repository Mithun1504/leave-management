import request from 'supertest';
import { createLeaveTestContext } from './helpers';

describe('employee leave views (AC5, AC7)', () => {
  let context: ReturnType<typeof createLeaveTestContext>;

  beforeEach(() => {
    context = createLeaveTestContext();
    context.db.prepare(`
      INSERT INTO leave_requests (employee_id, leave_type, start_date, end_date, reason, status)
      VALUES (?, 'Casual', '2999-01-04', '2999-01-05', 'Own pending leave', 'Pending')
    `).run(context.ids.employee);
    context.db.prepare(`
      INSERT INTO leave_requests (employee_id, leave_type, start_date, end_date, reason, status)
      VALUES (?, 'Sick', '2999-01-04', '2999-01-05', 'Other employee leave', 'Approved')
    `).run(context.ids.otherEmployee);
  });

  afterEach(() => context.close());

  it('returns only the employee’s requests and their current-year balances (AC5)', async () => {
    const requests = await request(context.app)
      .get('/api/leave/requests')
      .set('Authorization', `Bearer ${context.tokens.employee}`);
    const balances = await request(context.app)
      .get('/api/leave/balances')
      .set('Authorization', `Bearer ${context.tokens.employee}`);

    expect(requests.status).toBe(200);
    expect(requests.body.requests).toHaveLength(1);
    expect(requests.body.requests[0]).toMatchObject({
      employeeId: context.ids.employee,
      reason: 'Own pending leave',
      status: 'Pending'
    });
    expect(balances.status).toBe(200);
    expect(balances.body.year).toBe(new Date().getUTCFullYear());
    expect(balances.body.balances).toEqual([
      { leaveType: 'Casual', allocatedDays: 12, usedDays: 0, remainingDays: 12 },
      { leaveType: 'Sick', allocatedDays: 10, usedDays: 0, remainingDays: 10 },
      { leaveType: 'Earned', allocatedDays: 15, usedDays: 0, remainingDays: 15 }
    ]);
  });

  it('denies admins access to employee balances and leave requests (AC7)', async () => {
    const requests = await request(context.app)
      .get('/api/leave/requests')
      .set('Authorization', `Bearer ${context.tokens.admin}`);
    const balances = await request(context.app)
      .get('/api/leave/balances')
      .set('Authorization', `Bearer ${context.tokens.admin}`);
    expect(requests.status).toBe(403);
    expect(balances.status).toBe(403);
  });
});
