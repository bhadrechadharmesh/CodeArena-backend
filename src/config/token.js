import { randomBytes } from 'node:crypto';
if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)) {
  throw new Error('Set JWT_SECRET to a private value of at least 32 characters in production');
}
export const JWT_SECRET = process.env.JWT_SECRET || randomBytes(48).toString('hex');
