import { Router } from 'express';
import type Database from 'better-sqlite3';
import { z } from 'zod';
import { asyncHandler, HttpError } from '../../shared/http';
import { requireRole } from './middleware';
import { createUser } from './users';

const createUserSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().min(1),
  password: z.string().min(1),
  role: z.string().min(1),
  managerId: z.unknown().optional()
}).strict();

export function createUserRouter(db: Database.Database): Router {
  const router = Router();

  router.post('/', requireRole('admin'), asyncHandler(async (req, res) => {
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, 'INVALID_INPUT', 'Name, email, password, and role are required');
    }
    const user = createUser(db, parsed.data);
    res.status(201).json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      managerId: user.managerId
    });
  }));

  return router;
}
