import { Router, Response } from 'express';
import NotificationModel from '../models/Notification';
import Requirement from '../models/Requirement';
import Match from '../models/Match';
import Patient from '../models/Patient';
import Claim from '../models/Claim';
import QueryModel from '../models/Query';
import { requireAuth, requireStaff, AuthRequest } from '../middleware/authMiddleware';
import { generateNotification } from '../services/notificationGenerator';
import { getConfig } from '../lib/env';
import { deliverNotificationChannel } from '../services/notificationDelivery';

const router = Router();

/** POST /api/notifications/generate */
router.post('/generate', requireStaff, async (req: AuthRequest, res: Response) => {
  try {
    const { queryId } = req.body as { queryId?: string };
    if (!queryId) { res.status(400).json({ error: 'queryId is required' }); return; }

    const query = await QueryModel.findOne({ queryId });
    if (!query) { res.status(404).json({ error: 'Query not found' }); return; }

    if (query.matchingStatus !== 'COMPLETED') {
      res.status(422).json({ error: 'Document matching must be completed before generating a notification' });
      return;
    }

    const requirements = await Requirement.find({ queryId });
    const [patient, claim, matchResults] = await Promise.all([
      Patient.findOne({ patientId: query.patientId }),
      Claim.findOne({ claimId: query.claimId }),
      Match.find({ requirementId: { $in: requirements.map((r) => String(r._id)) } }),
    ]);

    if (!patient) { res.status(404).json({ error: 'Patient not found' }); return; }
    if (requirements.some((requirement) =>
      requirement.reviewStatus !== 'APPROVED'
      || !['MATCHED', 'MISSING'].includes(requirement.status)
      || !matchResults.some((match) => match.requirementId === String(requirement._id))
    ) || matchResults.some((match) => !['MATCHED', 'MISSING'].includes(match.status))) {
      res.status(422).json({ error: 'Requirements and document matches must be reviewed before preparing a patient message' });
      return;
    }

    // Get hospital settings from env/config (in production, store in Settings collection)
    const cfg = getConfig();

    const notification = generateNotification({
      patientName: patient.name,
      hospitalName: claim?.hospital || 'Demo Multispeciality Hospital',
      supportEmail: cfg.EMAIL_FROM !== 'noreply@revnow.local' ? cfg.EMAIL_FROM : undefined,
      requirements: requirements,
      matchResults: matchResults.map((m) => ({
        requirementId: m.requirementId,
        documentId: m.documentId,
        matchReason: m.matchReason,
        evidence: m.evidence,
        confidence: m.confidence,
        status: m.status,
      })),
    });

    res.json({
      message: 'Notification generated successfully',
      notification,
      readyToSend: notification.missingDocuments.length > 0,
    });
  } catch (err) {
    console.error('[Notifications] Generate error:', err);
    res.status(500).json({ error: 'Failed to generate notification' });
  }
});

/** POST /api/notifications/send */
router.post('/send', requireStaff, async (req: AuthRequest, res: Response) => {
  try {
    const { queryId, channel, messageText, recipientPhone, recipientEmail } = req.body as {
      queryId?: string;
      channel?: string;
      messageText?: string;
      recipientPhone?: string;
      recipientEmail?: string;
    };

    if (!queryId || !channel || !messageText) {
      res.status(400).json({ error: 'queryId, channel, and messageText are required' });
      return;
    }

    if (!['WHATSAPP', 'EMAIL'].includes(channel)) {
      res.status(400).json({ error: 'channel must be WHATSAPP or EMAIL' });
      return;
    }

    const query = await QueryModel.findOne({ queryId });
    if (!query) { res.status(404).json({ error: 'Query not found' }); return; }

    if (query.matchingStatus !== 'COMPLETED') {
      res.status(422).json({ error: 'Document matching must be completed before sending a patient message' });
      return;
    }

    const requirements = await Requirement.find({ queryId });
    const matches = await Match.find({ requirementId: { $in: requirements.map((r) => String(r._id)) } });
    if (requirements.some((requirement) =>
      requirement.reviewStatus !== 'APPROVED'
      || !['MATCHED', 'MISSING'].includes(requirement.status)
      || !matches.some((match) => match.requirementId === String(requirement._id))
    ) || matches.some((match) => !['MATCHED', 'MISSING'].includes(match.status))) {
      res.status(422).json({ error: 'Requirements and document matches must be reviewed before sending a patient message' });
      return;
    }
    if (!matches.some((match) => match.status === 'MISSING')) {
      res.status(422).json({ error: 'There are no confirmed missing documents to request for this query' });
      return;
    }

    const patient = await Patient.findOne({ patientId: query.patientId });
    if (!patient) { res.status(404).json({ error: 'Patient not found' }); return; }

    const delivery = await deliverNotificationChannel({
      queryId,
      claimId: query.claimId,
      patient,
      actor: req.user!.userId,
      channel: channel as 'WHATSAPP' | 'EMAIL',
      messageText,
      recipientPhone,
      recipientEmail,
    });

    if (delivery.alreadySent) {
      res.status(409).json({
        error: 'A notification for this query and channel has already been sent',
        existingNotificationId: delivery.notification.notificationId,
        status: delivery.notification.submissionStatus,
      });
      return;
    }

    res.status(201).json({ notification: delivery.notification, sendResult: delivery.sendResult });
  } catch (err) {
    console.error('[Notifications] Send error:', err);
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

/** GET /api/notifications */
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { patientId, queryId, channel, submissionStatus, page = '1', limit = '20' } = req.query as Record<string, string>;
    const query: Record<string, unknown> = {};
    if (patientId) query.patientId = patientId;
    if (queryId) query.queryId = queryId;
    if (channel) query.channel = channel;
    if (submissionStatus) query.submissionStatus = submissionStatus;

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, parseInt(limit, 10));

    const [notifications, total] = await Promise.all([
      NotificationModel.find(query).sort('-createdAt').skip((pageNum - 1) * limitNum).limit(limitNum).lean(),
      NotificationModel.countDocuments(query),
    ]);

    res.json({ data: notifications, pagination: { page: pageNum, limit: limitNum, total } });
  } catch {
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

/** GET /api/notifications/:id */
router.get('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const n = await NotificationModel.findOne({ notificationId: req.params.id }).lean();
    if (!n) { res.status(404).json({ error: 'Notification not found' }); return; }
    res.json(n);
  } catch {
    res.status(500).json({ error: 'Failed to fetch notification' });
  }
});

export default router;
