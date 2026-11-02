import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import NotificationModel from '../models/Notification';
import Requirement from '../models/Requirement';
import Match from '../models/Match';
import Patient from '../models/Patient';
import Claim from '../models/Claim';
import QueryModel from '../models/Query';
import { requireAuth, requireStaff, AuthRequest } from '../middleware/authMiddleware';
import { writeAudit } from '../lib/audit';
import { generateNotification } from '../services/notificationGenerator';
import { getConfig } from '../lib/env';
import { MetaWhatsAppAdapter } from '../adapters/whatsapp/MetaWhatsAppAdapter';
import { MockWhatsAppAdapter } from '../adapters/whatsapp/MockWhatsAppAdapter';
import { SmtpEmailAdapter } from '../adapters/email/SmtpEmailAdapter';
import { MockEmailAdapter } from '../adapters/email/MockEmailAdapter';

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

    const [patient, requirements, matchResults] = await Promise.all([
      Patient.findOne({ patientId: query.patientId }),
      Requirement.find({ queryId }),
      Match.find({ requirementId: { $in: (await Requirement.find({ queryId })).map((r) => String(r._id)) } }),
    ]);

    if (!patient) { res.status(404).json({ error: 'Patient not found' }); return; }

    // Get hospital settings from env/config (in production, store in Settings collection)
    const cfg = getConfig();
    const claim = await Claim.findOne({ claimId: query.claimId });

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

    const patient = await Patient.findOne({ patientId: query.patientId });
    if (!patient) { res.status(404).json({ error: 'Patient not found' }); return; }

    const cfg = getConfig();

    // Idempotency key: prevents duplicate sends
    const idempotencyKey = `${queryId}-${channel}-${uuidv4().slice(0, 8)}`;

    // Check for duplicate (same queryId + channel with non-failed status)
    const existing = await NotificationModel.findOne({
      queryId,
      channel,
      submissionStatus: { $in: ['SUBMITTED', 'SIMULATED', 'QUEUED'] },
    });
    if (existing) {
      res.status(409).json({
        error: 'A notification for this query and channel has already been sent',
        existingNotificationId: existing.notificationId,
        status: existing.submissionStatus,
      });
      return;
    }

    let sendResult: { success: boolean; providerMessageId?: string; status: string; errorMessage?: string };
    let providerName: string;

    if (channel === 'WHATSAPP') {
      const adapter = cfg.WHATSAPP_PROVIDER === 'meta'
        ? new MetaWhatsAppAdapter()
        : new MockWhatsAppAdapter();
      providerName = adapter.name;

      const phone = recipientPhone || patient.phone;
      sendResult = await adapter.send({
        to: phone,
        message: messageText,
        patientName: patient.name,
        claimId: query.claimId,
        idempotencyKey,
      });
    } else {
      const adapter = cfg.EMAIL_PROVIDER === 'smtp'
        ? new SmtpEmailAdapter()
        : new MockEmailAdapter();
      providerName = adapter.name;

      const email = recipientEmail || patient.email;
      const emailResult = await adapter.send({
        to: email,
        subject: 'Insurance Claim — Additional Documents Required',
        text: messageText,
        idempotencyKey,
      });
      sendResult = emailResult;
    }

    const notificationId = `NTF-${uuidv4().slice(0, 8).toUpperCase()}`;
    const notification = await NotificationModel.create({
      notificationId,
      patientId: query.patientId,
      claimId: query.claimId,
      queryId,
      channel,
      provider: providerName,
      message: messageText,
      providerMessageId: sendResult.providerMessageId,
      submissionStatus: sendResult.status,
      deliveryStatus: sendResult.status === 'SUBMITTED' ? 'SENT' : sendResult.status,
      idempotencyKey,
      errorMessage: sendResult.errorMessage,
    });

    await writeAudit({
      actor: req.user!.userId,
      action: 'NOTIFICATION_SENT',
      resourceType: 'Notification',
      resourceId: notificationId,
      metadata: {
        queryId, channel, provider: providerName,
        status: sendResult.status,
        hasRealMessageId: !!sendResult.providerMessageId,
      },
    });

    res.status(201).json({ notification, sendResult });
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
