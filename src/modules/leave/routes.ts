import { Router } from 'express';
import type Database from 'better-sqlite3';
import { z } from 'zod';
import { asyncHandler, HttpError } from '../../shared/http';
import { requireRole } from '../auth/middleware';
import type { AuthenticatedRequest } from '../auth/middleware';
import { LEAVE_TYPES } from './balance';
import { BalanceService } from './balance';
import { LeaveRequestService, type LeaveDecision } from './service';

function isISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

const createRequestSchema = z.object({
  leaveType: z.enum(LEAVE_TYPES),
  startDate: z.string().refine(isISODate),
  endDate: z.string().refine(isISODate),
  reason: z.string().refine((value) => value.trim().length > 0)
}).strict();

export function createLeaveRouter(db: Database.Database): Router {
  const router = Router();
  const requests = new LeaveRequestService(db);
  const balances = new BalanceService(db);

  router.get('/requests', (req, res) => {
    const user = (req as AuthenticatedRequest).authUser;
    if (!user) throw new HttpError(401, 'UNAUTHORIZED', 'A valid access token is required');
    if (user.role === 'employee') {
      res.status(200).json({ requests: requests.listForEmployee(user.id) });
      return;
    }
    if (user.role === 'manager') {
      res.status(200).json({ requests: requests.listForManager(user.id) });
      return;
    }
    throw new HttpError(403, 'FORBIDDEN', 'You are not allowed to view leave requests');
  });

  router.get('/balances', requireRole('employee'), (req, res) => {
    const user = (req as AuthenticatedRequest).authUser;
    if (!user) throw new HttpError(401, 'UNAUTHORIZED', 'A valid access token is required');
    res.status(200).json(balances.balancesForYear(user.id));
  });

  router.post('/requests', requireRole('employee'), asyncHandler(async (req, res) => {
    const parsed = createRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, 'INVALID_INPUT', 'Leave type, valid dates, and a non-empty reason are required');
    }
    const user = (req as AuthenticatedRequest).authUser;
    if (!user) throw new HttpError(401, 'UNAUTHORIZED', 'A valid access token is required');
    const created = requests.create(user.id, parsed.data);
    res.status(201).json(created);
  }));

  router.post('/requests/:requestId/decision', requireRole('manager'), asyncHandler(async (req, res) => {
    if (!/^\d+$/.test(req.params.requestId) || Number(req.params.requestId) < 1) {
      throw new HttpError(400, 'INVALID_INPUT', 'Request ID must be a positive integer');
    }
    const decisionSchema = z.object({ decision: z.enum(['Approved', 'Rejected']) }).strict();
    const parsed = decisionSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, 'INVALID_INPUT', 'Decision must be Approved or Rejected');
    const user = (req as AuthenticatedRequest).authUser;
    if (!user) throw new HttpError(401, 'UNAUTHORIZED', 'A valid access token is required');
    const decided = requests.decide(Number(req.params.requestId), user.id, parsed.data.decision as LeaveDecision);
    res.status(200).json(decided);
  }));

  return router;
}
