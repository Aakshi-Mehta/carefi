import { Request, Response, NextFunction } from 'express';
import { verifyToken, extractTokenFromHeader, JwtPayload } from '../lib/auth';

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

/** Middleware: require a valid JWT. */
export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const token = extractTokenFromHeader(req.headers.authorization);

  if (!token) {
    res.status(401).json({ error: 'Unauthorized: Missing token' });
    return;
  }

  try {
    const payload = verifyToken(token);
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
  }
}

/** Middleware: require admin role. */
export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
  requireAuth(req, res, () => {
    if (req.user?.role !== 'admin') {
      res.status(403).json({ error: 'Forbidden: Admin role required' });
      return;
    }
    next();
  });
}

/** Middleware: require admin or staff role. */
export function requireStaff(req: AuthRequest, res: Response, next: NextFunction): void {
  requireAuth(req, res, () => {
    if (!req.user || !['admin', 'staff'].includes(req.user.role)) {
      res.status(403).json({ error: 'Forbidden: Staff or Admin role required' });
      return;
    }
    next();
  });
}
