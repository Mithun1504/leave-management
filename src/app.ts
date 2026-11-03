import express from 'express';
import path from 'node:path';
import type Database from 'better-sqlite3';
import { z } from 'zod';
import { login } from './modules/auth/login';
import { requireAuth } from './modules/auth/middleware';
import { createUserRouter } from './modules/auth/routes';
import { createLeaveRouter } from './modules/leave/routes';
import { asyncHandler, errorHandler, HttpError } from './shared/http';

export function createApp(db: Database.Database) {
  const app = express();
  app.use(express.static(path.resolve(process.cwd(), 'public')));
  app.post('/api/auth/login', express.json(), asyncHandler(async (req, res) => {
    const parsed = z.object({
      email: z.string().trim().min(1),
      password: z.string().min(1)
    }).strict().safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, 'INVALID_INPUT', 'Email and password are required');
    }
    res.status(200).json(login(db, parsed.data));
  }));
  app.use('/api', requireAuth(db));
  app.use(express.json());
  app.use('/api/users', createUserRouter(db));
  app.use('/api/leave', createLeaveRouter(db));
  app.use((_req, _res, next) => next(new HttpError(404, 'NOT_FOUND', 'Endpoint not found')));
  app.use(errorHandler);
  return app;
}
