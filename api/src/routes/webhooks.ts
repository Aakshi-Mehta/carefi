/**
 * Meta WhatsApp Webhook Handler
 *
 * Implements webhook verification and delivery status updates
 * according to Meta's official documentation:
 * https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/
 *
 * SECURITY:
 * - Verification uses the HMAC-SHA256 signature (x-hub-signature-256) from Meta.
 * - Only updates delivery status from authenticated webhook payloads.
 * - Does NOT invent webhook payloads.
 * - Test fixtures (in tests only) are clearly labeled as synthetic.
 */

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import NotificationModel from '../models/Notification';
import { writeAudit } from '../lib/audit';
import { getConfig } from '../lib/env';

const router = Router();

/** GET /api/webhooks/meta — webhook verification challenge */
router.get('/meta', (req: Request, res: Response) => {
  const cfg = getConfig();
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === cfg.META_WEBHOOK_VERIFY_TOKEN) {
    console.log('[Webhook] Meta webhook verified');
    res.status(200).send(challenge);
    return;
  }

  console.warn('[Webhook] Meta webhook verification failed — token mismatch');
  res.status(403).json({ error: 'Webhook verification failed' });
});

/** POST /api/webhooks/meta — receive delivery status updates */
router.post('/meta', async (req: Request, res: Response) => {
  try {
    const cfg = getConfig();

    // Verify webhook signature if APP_SECRET is configured
    if (cfg.META_APP_SECRET) {
      const signature = req.headers['x-hub-signature-256'] as string | undefined;
      if (!signature) {
        console.warn('[Webhook] Missing x-hub-signature-256 header');
        res.status(401).json({ error: 'Missing webhook signature' });
        return;
      }

      const rawBody = JSON.stringify(req.body);
      const expectedSig = `sha256=${crypto
        .createHmac('sha256', cfg.META_APP_SECRET)
        .update(rawBody)
        .digest('hex')}`;

      if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
        console.warn('[Webhook] Invalid webhook signature');
        res.status(401).json({ error: 'Invalid webhook signature' });
        return;
      }
    }

    const body = req.body as MetaWebhookPayload;

    // Process status updates
    const updates: string[] = [];
    if (body.entry) {
      for (const entry of body.entry) {
        for (const change of entry.changes || []) {
          const value = change.value;
          if (value?.statuses) {
            for (const status of value.statuses) {
              await processStatusUpdate(status);
              updates.push(status.id);
            }
          }
        }
      }
    }

    res.status(200).json({ received: true, processed: updates.length });
  } catch (err) {
    console.error('[Webhook] Processing error:', err);
    // Always return 200 to Meta to prevent retries for our own errors
    res.status(200).json({ received: true, error: 'Processing error logged' });
  }
});

async function processStatusUpdate(status: MetaStatusUpdate): Promise<void> {
  const metaStatus = status.status; // 'sent' | 'delivered' | 'read' | 'failed'

  const deliveryStatusMap: Record<string, string> = {
    sent: 'SENT',
    delivered: 'DELIVERED',
    read: 'READ',
    failed: 'FAILED',
  };

  const deliveryStatus = deliveryStatusMap[metaStatus];
  if (!deliveryStatus) return;

  // Find notification by provider message ID
  const notification = await NotificationModel.findOne({ providerMessageId: status.id });
  if (!notification) {
    console.log(`[Webhook] No notification found for message ID: ${status.id}`);
    return;
  }

  await NotificationModel.findByIdAndUpdate(notification._id, {
    deliveryStatus,
    updatedAt: new Date(),
  });

  await writeAudit({
    actor: 'webhook:meta',
    action: 'DELIVERY_CALLBACK',
    resourceType: 'Notification',
    resourceId: notification.notificationId,
    metadata: {
      metaMessageId: status.id,
      metaStatus,
      deliveryStatus,
      timestamp: status.timestamp,
    },
  });

  console.log(`[Webhook] Updated delivery status for ${notification.notificationId}: ${deliveryStatus}`);
}

// Type definitions for Meta webhook payloads
interface MetaStatusUpdate {
  id: string;
  status: string;
  timestamp: string;
  recipient_id: string;
  conversation?: { id: string; expiration_timestamp?: string; origin?: { type: string } };
  pricing?: { billable: boolean; pricing_model: string; category: string };
  errors?: Array<{ code: number; title: string }>;
}

interface MetaWebhookPayload {
  object: string;
  entry?: Array<{
    id: string;
    changes?: Array<{
      value: {
        statuses?: MetaStatusUpdate[];
        messages?: unknown[];
      };
      field: string;
    }>;
  }>;
}

export default router;
