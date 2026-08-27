import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { Role } from '../types';

export interface AuthUser {
  id: string;
  username: string;
  role: Role;
  institutionId: string | null;
  fullName: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

export function signToken(user: AuthUser): string {
  return jwt.sign(user, JWT_SECRET, { expiresIn: '12h' });
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'לא מחוברת למערכת' });
  }
  const token = header.slice('Bearer '.length);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as AuthUser;
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'החיבור פג תוקף, יש להתחבר מחדש' });
  }
}

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'אין הרשאה מתאימה לפעולה זו' });
    }
    next();
  };
}

// Resolves the institutionId a request should operate on:
// - SYSTEM_ADMIN can act on any institution, must pass ?institutionId= or body.institutionId
// - SECRETARY / PRINCIPAL are locked to their own institution
export function resolveInstitutionId(req: Request): string | null {
  if (!req.user) return null;
  if (req.user.role === 'SYSTEM_ADMIN') {
    return (req.query.institutionId as string) || req.body?.institutionId || null;
  }
  return req.user.institutionId;
}
