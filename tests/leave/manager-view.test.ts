import request from 'supertest';
import { createLeaveTestContext } from './helpers';

describe('manager team request view (AC6, AC8)', () => {
  let context: ReturnType<typeof createLeaveTestContext>;

  beforeEach(() => {
    context = createLeaveTestContext();
    context.db.prepare(`
      INSERT INTO leave_requests (employee_id, leave_type, start_date, end_date, reason)
      VALUES (?, 'Casual', '2999-01-04', '2999-01-05', 'Assigned employee request')
    `).run(context.ids.employee);
    context.db.prepare(`
      INSERT INTO leave_requests (employee_id, leave_type, start_date, end_date, reason)
      VALUES (?, 'Sick', '2999-01-04', '2999-01-05', 'Other team request')
    `).run(context.ids.otherEmployee);
  });

  afterEach(() => context.close());

  it('returns only requests from employees currently assigned to the manager (AC6)', async () => {
    const response = await request(context.app)
      .get('/api/leave/requests')
      .set('Authorization', `Bearer ${context.tokens.manager}`);

    expect(response.status).toBe(200);
    expect(response.body.requests).toHaveLength(1);
    expect(response.body.requests[0]).toMatchObject({
      employeeId: context.ids.employee,
      reason: 'Assigned employee request'
    });
  });

  it('denies admins and unrelated employees access to other employees’ requests (AC8)', async () => {
    const admin = await request(context.app)
      .get('/api/leave/requests')
      .set('Authorization', `Bearer ${context.tokens.admin}`);
    const unrelatedEmployee = await request(context.app)
      .get('/api/leave/requests')
      .set('Authorization', `Bearer ${context.tokens.otherEmployee}`);

    expect(admin.status).toBe(403);
    expect(unrelatedEmployee.status).toBe(200);
    expect(unrelatedEmployee.body.requests).toHaveLength(1);
    expect(unrelatedEmployee.body.requests[0].employeeId).toBe(context.ids.otherEmployee);
  });

  it('reflects current manager assignments in team views (AC6)', async () => {
    context.db.prepare('UPDATE users SET manager_id = ? WHERE id = ?')
      .run(context.ids.otherManager, context.ids.employee);

    const oldManager = await request(context.app)
      .get('/api/leave/requests')
      .set('Authorization', `Bearer ${context.tokens.manager}`);
    const newManager = await request(context.app)
      .get('/api/leave/requests')
      .set('Authorization', `Bearer ${context.tokens.otherManager}`);

    expect(oldManager.body.requests).toHaveLength(0);
    expect(newManager.body.requests).toHaveLength(2);
  });
});
