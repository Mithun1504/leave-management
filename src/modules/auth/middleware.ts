import type Database from 'better-sqlite3';
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { findUserById, type UserRecord } from './users';
import { sendError } from '../../shared/http';

export interface AuthenticatedRequest extends Request {
  authUser?: UserRecord;
}

export function requireAuth(db: Database.Database) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authorization = req.header('authorization');
    const match = authorization?.match(/^Bearer\s+(.+)$/i);
    const secret = process.env.JWT_SECRET;
    if (!match || !secret) {
      sendError(res, 401, 'UNAUTHORIZED', 'A valid access token is required');
      return;
    }

    try {
      const payload = jwt.verify(match[1], secret);
      if (typeof payload === 'string' || typeof payload.sub !== 'string' || !/^\d+$/.test(payload.sub)) {
        sendError(res, 401, 'UNAUTHORIZED', 'A valid access token is required');
        return;
      }
      const user = findUserById(db, Number(payload.sub));
      if (!user || !user.isActive) {
        sendError(res, 401, 'UNAUTHORIZED', 'A valid access token is required');
        return;
      }
      (req as AuthenticatedRequest).authUser = user;
      next();
    } catch {
      sendError(res, 401, 'UNAUTHORIZED', 'A valid access token is required');
    }
  };
}

export function requireRole(role: UserRecord['role']) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as AuthenticatedRequest).authUser;
    if (!user || user.role !== role) {
      sendError(res, 403, 'FORBIDDEN', 'You are not allowed to perform this action');
      return;
    }
    next();
  };
}
