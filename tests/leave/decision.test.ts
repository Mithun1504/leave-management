import request from 'supertest';
import { BalanceService } from '../../src/modules/leave/balance';
import { createLeaveTestContext } from './helpers';

describe('manager leave decisions (AC3, AC4, AC7, AC8)', () => {
  let context: ReturnType<typeof createLeaveTestContext>;

  beforeEach(() => { context = createLeaveTestContext(); });
  afterEach(() => context.close());

  function createRequest(leaveType = 'Casual', startDate = '2999-01-04', endDate = '2999-01-04') {
    return Number(context.db.prepare(`
      INSERT INTO leave_requests (employee_id, leave_type, start_date, end_date, reason)
      VALUES (?, ?, ?, ?, 'Decision test')
    `).run(context.ids.employee, leaveType, startDate, endDate).lastInsertRowid);
  }

  it('approves a request and deducts its weekdays from the matching balance (AC3, AC4)', async () => {
    const id = createRequest();
    const response = await request(context.app)
      .post(`/api/leave/requests/${id}/decision`)
      .set('Authorization', `Bearer ${context.tokens.manager}`)
      .send({ decision: 'Approved' });
    const balances = new BalanceService(context.db).balancesForYear(context.ids.employee, 2999);

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('Approved');
    expect(balances.balances.find((item) => item.leaveType === 'Casual')).toMatchObject({
      usedDays: 1, remainingDays: 11
    });
  });

  it('rejects a request without reducing its balance and prevents a second decision (AC3, AC7)', async () => {
    const id = createRequest('Sick', '2999-01-07', '2999-01-07');
    const rejected = await request(context.app)
      .post(`/api/leave/requests/${id}/decision`)
      .set('Authorization', `Bearer ${context.tokens.manager}`)
      .send({ decision: 'Rejected' });
    const repeated = await request(context.app)
      .post(`/api/leave/requests/${id}/decision`)
      .set('Authorization', `Bearer ${context.tokens.manager}`)
      .send({ decision: 'Approved' });
    const balances = new BalanceService(context.db).balancesForYear(context.ids.employee, 2999);

    expect(rejected.status).toBe(200);
    expect(rejected.body.status).toBe('Rejected');
    expect(repeated.status).toBe(409);
    expect(balances.balances.find((item) => item.leaveType === 'Sick')).toMatchObject({
      usedDays: 0, remainingDays: 10
    });
  });

  it('denies approval when the request exceeds remaining balance (AC4)', async () => {
    context.db.prepare(`
      INSERT INTO leave_requests (employee_id, leave_type, start_date, end_date, reason, status)
      VALUES (?, 'Casual', '2999-01-04', '2999-01-21', 'Uses all days', 'Approved')
    `).run(context.ids.employee);
    const id = createRequest('Casual', '2999-01-22', '2999-01-22');
    const response = await request(context.app)
      .post(`/api/leave/requests/${id}/decision`)
      .set('Authorization', `Bearer ${context.tokens.manager}`)
      .send({ decision: 'Approved' });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('INSUFFICIENT_BALANCE');
    expect((context.db.prepare('SELECT status FROM leave_requests WHERE id = ?').get(id) as { status: string }).status)
      .toBe('Pending');
  });

  it('allows only the currently assigned manager to decide (AC3, AC8)', async () => {
    const id = createRequest();
    const admin = await request(context.app)
      .post(`/api/leave/requests/${id}/decision`)
      .set('Authorization', `Bearer ${context.tokens.admin}`)
      .send({ decision: 'Approved' });
    const wrongManager = await request(context.app)
      .post(`/api/leave/requests/${id}/decision`)
      .set('Authorization', `Bearer ${context.tokens.otherManager}`)
      .send({ decision: 'Approved' });
    const unrelatedEmployee = await request(context.app)
      .post(`/api/leave/requests/${id}/decision`)
      .set('Authorization', `Bearer ${context.tokens.otherEmployee}`)
      .send({ decision: 'Approved' });

    expect(admin.status).toBe(403);
    expect(wrongManager.status).toBe(403);
    expect(unrelatedEmployee.status).toBe(403);
  });

  it('uses the current manager assignment when deciding (AC3, AC8)', async () => {
    const id = createRequest();
    context.db.prepare('UPDATE users SET manager_id = ? WHERE id = ?')
      .run(context.ids.otherManager, context.ids.employee);
    const oldManager = await request(context.app)
      .post(`/api/leave/requests/${id}/decision`)
      .set('Authorization', `Bearer ${context.tokens.manager}`)
      .send({ decision: 'Rejected' });
    const currentManager = await request(context.app)
      .post(`/api/leave/requests/${id}/decision`)
      .set('Authorization', `Bearer ${context.tokens.otherManager}`)
      .send({ decision: 'Rejected' });

    expect(oldManager.status).toBe(403);
    expect(currentManager.status).toBe(200);
  });
});
