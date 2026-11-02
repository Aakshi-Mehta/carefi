import jwt from 'jsonwebtoken';
import { getConfig } from './env';

export interface JwtPayload {
  userId: string;
  email: string;
  role: 'admin' | 'staff' | 'reviewer';
}

export function signToken(payload: JwtPayload): string {
  const { JWT_SECRET, JWT_EXPIRES_IN } = getConfig();
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions);
}

export function verifyToken(token: string): JwtPayload {
  const { JWT_SECRET } = getConfig();
  const decoded = jwt.verify(token, JWT_SECRET);
  return decoded as JwtPayload;
}

export function extractTokenFromHeader(authHeader: string | undefined): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return authHeader.slice(7);
}
