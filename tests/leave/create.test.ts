import request from 'supertest';
import { BalanceService } from '../../src/modules/leave/balance';
import { createLeaveTestContext } from './helpers';

describe('create leave request (AC1, AC7)', () => {
  let context: ReturnType<typeof createLeaveTestContext>;

  beforeEach(() => { context = createLeaveTestContext(); });
  afterEach(() => context.close());

  it('creates a Pending request with the supplied fields (AC1)', async () => {
    const response = await request(context.app)
      .post('/api/leave/requests')
      .set('Authorization', `Bearer ${context.tokens.employee}`)
      .send({ leaveType: 'Casual', startDate: '2999-01-04', endDate: '2999-01-05', reason: 'Personal leave' });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      id: expect.any(Number),
      employeeId: context.ids.employee,
      leaveType: 'Casual',
      startDate: '2999-01-04',
      endDate: '2999-01-05',
      reason: 'Personal leave',
      status: 'Pending'
    });
    const stored = context.db.prepare('SELECT status FROM leave_requests WHERE id = ?').get(response.body.id) as { status: string };
    expect(stored.status).toBe('Pending');
  });

  it('rejects invalid fields and date business rules', async () => {
    const invalidField = await request(context.app)
      .post('/api/leave/requests')
      .set('Authorization', `Bearer ${context.tokens.employee}`)
      .send({ leaveType: 'Vacation', startDate: '2999-01-04', endDate: '2999-01-05', reason: 'x' });
    const invalidCalendarDate = await request(context.app)
      .post('/api/leave/requests')
      .set('Authorization', `Bearer ${context.tokens.employee}`)
      .send({ leaveType: 'Casual', startDate: '2999-02-30', endDate: '2999-03-02', reason: 'x' });
    const pastDate = await request(context.app)
      .post('/api/leave/requests')
      .set('Authorization', `Bearer ${context.tokens.employee}`)
      .send({ leaveType: 'Casual', startDate: '2000-01-01', endDate: '2000-01-03', reason: 'x' });
    const reversed = await request(context.app)
      .post('/api/leave/requests')
      .set('Authorization', `Bearer ${context.tokens.employee}`)
      .send({ leaveType: 'Casual', startDate: '2999-01-05', endDate: '2999-01-04', reason: 'x' });

    expect(invalidField.status).toBe(400);
    expect(invalidCalendarDate.status).toBe(400);
    expect(pastDate.status).toBe(422);
    expect(reversed.status).toBe(422);
  });

  it('rejects overlapping pending and approved requests without reserving balance (AC7)', async () => {
    const first = await request(context.app)
      .post('/api/leave/requests')
      .set('Authorization', `Bearer ${context.tokens.employee}`)
      .send({ leaveType: 'Casual', startDate: '2999-01-04', endDate: '2999-01-06', reason: 'First' });
    const overlappingPending = await request(context.app)
      .post('/api/leave/requests')
      .set('Authorization', `Bearer ${context.tokens.employee}`)
      .send({ leaveType: 'Sick', startDate: '2999-01-05', endDate: '2999-01-05', reason: 'Overlap' });
    const pendingBalance = new BalanceService(context.db).balancesForYear(context.ids.employee, 2999);

    context.db.prepare("UPDATE leave_requests SET status = 'Approved' WHERE id = ?").run(first.body.id);
    const overlappingApproved = await request(context.app)
      .post('/api/leave/requests')
      .set('Authorization', `Bearer ${context.tokens.employee}`)
      .send({ leaveType: 'Earned', startDate: '2999-01-06', endDate: '2999-01-07', reason: 'Overlap' });

    const balance = new BalanceService(context.db).balancesForYear(context.ids.employee, 2999);
    expect(first.status).toBe(201);
    expect(overlappingPending.status).toBe(409);
    expect(overlappingApproved.status).toBe(409);
    expect(pendingBalance.balances.find((item) => item.leaveType === 'Casual')?.usedDays).toBe(0);
    expect(balance.balances.find((item) => item.leaveType === 'Casual')?.usedDays).toBe(1);
    expect(balance.balances.find((item) => item.leaveType === 'Sick')?.usedDays).toBe(0);
  });

  it('allows only employees to submit requests', async () => {
    const response = await request(context.app)
      .post('/api/leave/requests')
      .set('Authorization', `Bearer ${context.tokens.admin}`)
      .send({ leaveType: 'Casual', startDate: '2999-01-04', endDate: '2999-01-05', reason: 'x' });
    expect(response.status).toBe(403);
  });
});
