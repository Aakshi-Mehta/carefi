import { Router, Response } from 'express';
import Patient from '../models/Patient';
import Claim from '../models/Claim';
import DocumentModel from '../models/Document';
import QueryModel from '../models/Query';
import Requirement from '../models/Requirement';
import NotificationModel from '../models/Notification';
import AuditLog from '../models/AuditLog';
import { requireAuth, AuthRequest } from '../middleware/authMiddleware';

const router = Router();

/** GET /api/dashboard — aggregated stats from real DB */
router.get('/', requireAuth, async (_req: AuthRequest, res: Response) => {
  try {
    const [
      totalPatients,
      activeClaims,
      pendingQueries,
      totalDocuments,
      pendingNotifications,
      recentAuditLogs,
      missingDocCount,
      queriesNeedingReview,
    ] = await Promise.all([
      Patient.countDocuments(),
      Claim.countDocuments({ status: { $in: ['OPEN', 'QUERY_RECEIVED', 'DOCUMENTS_PENDING', 'UNDER_REVIEW'] } }),
      QueryModel.countDocuments({ extractionStatus: 'PENDING' }),
      DocumentModel.countDocuments(),
      NotificationModel.countDocuments({ submissionStatus: { $in: ['NOT_CONFIGURED', 'FAILED', 'QUEUED'] } }),
      AuditLog.find().sort({ timestamp: -1 }).limit(20).lean(),
      Requirement.countDocuments({ status: 'MISSING' }),
      Requirement.countDocuments({ status: 'UNCERTAIN' }),
    ]);

    res.json({
      stats: {
        totalPatients,
        activeClaims,
        pendingQueries,
        totalDocuments,
        missingDocuments: missingDocCount,
        queriesNeedingReview,
        pendingNotifications,
      },
      recentActivity: recentAuditLogs,
    });
  } catch (err) {
    console.error('[Dashboard] Error:', err);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

export default router;
