import type Database from 'better-sqlite3';
import { HttpError } from '../../shared/http';
import { BalanceService, weekdaysByYear, type LeaveType } from './balance';

export interface CreateLeaveRequestInput {
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  reason: string;
}

export interface LeaveRequestRecord {
  id: number;
  employeeId: number;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  reason: string;
  status: 'Pending' | 'Approved' | 'Rejected';
}

export type LeaveDecision = 'Approved' | 'Rejected';

function isISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

function fromRow(row: Record<string, unknown>): LeaveRequestRecord {
  return {
    id: Number(row.id),
    employeeId: Number(row.employeeId),
    leaveType: row.leaveType as LeaveType,
    startDate: String(row.startDate),
    endDate: String(row.endDate),
    reason: String(row.reason),
    status: row.status as LeaveRequestRecord['status']
  };
}

export class LeaveRequestService {
  private readonly balances: BalanceService;

  constructor(private readonly db: Database.Database) {
    this.balances = new BalanceService(db);
  }

  listForEmployee(employeeId: number): LeaveRequestRecord[] {
    const rows = this.db.prepare(`
      SELECT id, employee_id AS employeeId, leave_type AS leaveType,
        start_date AS startDate, end_date AS endDate, reason, status
      FROM leave_requests WHERE employee_id = ?
    `).all(employeeId) as Array<Record<string, unknown>>;
    return rows.map(fromRow);
  }

  listForManager(managerId: number): LeaveRequestRecord[] {
    const rows = this.db.prepare(`
      SELECT lr.id, lr.employee_id AS employeeId, lr.leave_type AS leaveType,
        lr.start_date AS startDate, lr.end_date AS endDate, lr.reason, lr.status
      FROM leave_requests AS lr
      JOIN users AS employee ON employee.id = lr.employee_id
      WHERE employee.manager_id = ? AND employee.role = 'employee'
    `).all(managerId) as Array<Record<string, unknown>>;
    return rows.map(fromRow);
  }

  create(employeeId: number, input: CreateLeaveRequestInput): LeaveRequestRecord {
    if (!isISODate(input.startDate) || !isISODate(input.endDate)) {
      throw new HttpError(400, 'INVALID_INPUT', 'Dates must be valid YYYY-MM-DD values');
    }
    if (input.startDate < todayUTC() || input.endDate < input.startDate) {
      throw new HttpError(422, 'BUSINESS_RULE_VIOLATION', 'Dates must start today or later and end on or after the start date');
    }

    const createWithinTransaction = this.db.transaction(() => {
      const overlap = this.db.prepare(`
        SELECT id FROM leave_requests
        WHERE employee_id = ? AND status IN ('Pending', 'Approved')
          AND start_date <= ? AND end_date >= ?
        LIMIT 1
      `).get(employeeId, input.endDate, input.startDate);
      if (overlap) {
        throw new HttpError(409, 'LEAVE_OVERLAP', 'Request overlaps pending or approved leave');
      }

      const result = this.db.prepare(`
        INSERT INTO leave_requests (employee_id, leave_type, start_date, end_date, reason)
        VALUES (?, ?, ?, ?, ?)
      `).run(employeeId, input.leaveType, input.startDate, input.endDate, input.reason);
      const row = this.db.prepare(`
        SELECT id, employee_id AS employeeId, leave_type AS leaveType,
          start_date AS startDate, end_date AS endDate, reason, status
        FROM leave_requests WHERE id = ?
      `).get(result.lastInsertRowid) as Record<string, unknown>;
      return fromRow(row);
    });

    return createWithinTransaction.immediate();
  }

  decide(requestId: number, managerId: number, decision: LeaveDecision): LeaveRequestRecord {
    const decideWithinTransaction = this.db.transaction(() => {
      const row = this.db.prepare(`
        SELECT id, employee_id AS employeeId, leave_type AS leaveType,
          start_date AS startDate, end_date AS endDate, reason, status
        FROM leave_requests WHERE id = ?
      `).get(requestId) as Record<string, unknown> | undefined;
      if (!row) throw new HttpError(404, 'NOT_FOUND', 'Leave request does not exist');

      const employee = this.db.prepare(`
        SELECT id FROM users WHERE id = ? AND role = 'employee' AND manager_id = ?
      `).get(row.employeeId, managerId);
      if (!employee) {
        throw new HttpError(403, 'FORBIDDEN', 'Only the employee’s currently assigned manager can decide this request');
      }
      if (row.status !== 'Pending') {
        throw new HttpError(409, 'REQUEST_ALREADY_DECIDED', 'Only pending requests can be decided');
      }

      const request = fromRow(row);
      if (decision === 'Approved') {
        const daysByYear = weekdaysByYear(request);
        for (const [year, requestedDays] of daysByYear) {
          const balance = this.balances.balancesForYear(request.employeeId, year)
            .balances.find((item) => item.leaveType === request.leaveType);
          if (!balance || requestedDays > balance.remainingDays) {
            throw new HttpError(422, 'INSUFFICIENT_BALANCE', 'Insufficient balance to approve this request');
          }
        }
      }

      const update = this.db.prepare(`
        UPDATE leave_requests SET status = ? WHERE id = ? AND status = 'Pending'
      `).run(decision, requestId);
      if (update.changes !== 1) {
        throw new HttpError(409, 'REQUEST_ALREADY_DECIDED', 'Only pending requests can be decided');
      }
      return { ...request, status: decision };
    });

    return decideWithinTransaction.immediate();
  }
}
