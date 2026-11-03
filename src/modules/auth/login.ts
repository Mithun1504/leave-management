import bcrypt from 'bcryptjs';
import type Database from 'better-sqlite3';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { HttpError } from '../../shared/http';

export interface LoginInput {
  email: string;
  password: string;
}

export function login(db: Database.Database, input: LoginInput): { accessToken: string } {
  const user = db.prepare(`
    SELECT id, password_hash AS passwordHash
    FROM users WHERE email = ? AND is_active = 1
  `).get(input.email) as { id: number; passwordHash: string } | undefined;

  if (!user || !bcrypt.compareSync(input.password, user.passwordHash)) {
    throw new HttpError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect');
  }

  const secret = process.env.JWT_SECRET;
  const expiresIn = process.env.JWT_EXPIRES_IN;
  if (!secret || !expiresIn) {
    throw new HttpError(500, 'CONFIGURATION_ERROR', 'JWT_SECRET and JWT_EXPIRES_IN must be configured');
  }

  const options: SignOptions = {
    subject: String(user.id),
    expiresIn: expiresIn as SignOptions['expiresIn']
  };
  return { accessToken: jwt.sign({}, secret, options) };
}
