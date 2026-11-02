import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import User from '../models/User';
import { signToken } from '../lib/auth';
import { writeAudit } from '../lib/audit';
import { requireAdmin, requireAuth, AuthRequest } from '../middleware/authMiddleware';

const router = Router();

/** POST /api/auth/register */
router.post('/register', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { email, password, name, role } = req.body as {
      email?: string;
      password?: string;
      name?: string;
      role?: string;
    };

    if (!email || !password || !name) {
      res.status(400).json({ error: 'email, password, and name are required' });
      return;
    }

    if (password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters' });
      return;
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({
      userId: `USR-${uuidv4().slice(0, 8).toUpperCase()}`,
      email: email.toLowerCase(),
      passwordHash,
      name,
      role: role === 'admin' ? 'admin' : role === 'reviewer' ? 'reviewer' : 'staff',
    });

    await writeAudit({
      actor: req.user!.userId,
      action: 'USER_CREATED',
      resourceType: 'User',
      resourceId: user.userId,
      metadata: { email: user.email, role: user.role },
    });

    const token = signToken({ userId: user.userId, email: user.email, role: user.role });
    res.status(201).json({ token, user: { userId: user.userId, email: user.email, name: user.name, role: user.role } });
  } catch (err) {
    console.error('[Auth] Register error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

/** POST /api/auth/login */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };

    if (!email || !password) {
      res.status(400).json({ error: 'email and password are required' });
      return;
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || !user.isActive) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    await writeAudit({
      actor: user.userId,
      action: 'USER_LOGIN',
      resourceType: 'User',
      resourceId: user.userId,
    });

    const token = signToken({ userId: user.userId, email: user.email, role: user.role });
    res.json({ token, user: { userId: user.userId, email: user.email, name: user.name, role: user.role } });
  } catch (err) {
    console.error('[Auth] Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

/** GET /api/auth/me */
router.get('/me', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findOne({ userId: req.user!.userId });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json({ userId: user.userId, email: user.email, name: user.name, role: user.role });
  } catch {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

export default router;
