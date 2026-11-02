import { Router, Response } from 'express';
import AuditLog from '../models/AuditLog';
import { requireAuth, AuthRequest } from '../middleware/authMiddleware';

const router = Router();

/** GET /api/activity — paginated audit log */
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { page = '1', limit = '30', actor, action, resourceType } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, parseInt(limit, 10));

    const query: Record<string, unknown> = {};
    if (actor) query.actor = actor;
    if (action) query.action = action;
    if (resourceType) query.resourceType = resourceType;

    const [logs, total] = await Promise.all([
      AuditLog.find(query).sort({ timestamp: -1 }).skip((pageNum - 1) * limitNum).limit(limitNum).lean(),
      AuditLog.countDocuments(query),
    ]);

    res.json({ data: logs, pagination: { page: pageNum, limit: limitNum, total } });
  } catch {
    res.status(500).json({ error: 'Failed to fetch activity log' });
  }
});

export default router;
