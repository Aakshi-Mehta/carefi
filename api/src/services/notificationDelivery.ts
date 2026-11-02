import { v4 as uuidv4 } from 'uuid';
import NotificationModel, { type INotification, type NotificationChannel } from '../models/Notification';
import type { IPatient } from '../models/Patient';
import { writeAudit } from '../lib/audit';
import { getConfig } from '../lib/env';
import { MetaWhatsAppAdapter } from '../adapters/whatsapp/MetaWhatsAppAdapter';
import { MockWhatsAppAdapter } from '../adapters/whatsapp/MockWhatsAppAdapter';
import { SmtpEmailAdapter } from '../adapters/email/SmtpEmailAdapter';
import { MockEmailAdapter } from '../adapters/email/MockEmailAdapter';

type DeliveryResult = {
  notification: INotification;
  sendResult: {
    success: boolean;
    providerMessageId?: string;
    status: string;
    errorMessage?: string;
  };
  alreadySent: boolean;
};

export async function deliverNotificationChannel(params: {
  queryId: string;
  claimId: string;
  patient: IPatient;
  actor: string;
  channel: NotificationChannel;
  messageText: string;
  recipientPhone?: string;
  recipientEmail?: string;
}): Promise<DeliveryResult> {
  const { queryId, claimId, patient, actor, channel, messageText, recipientPhone, recipientEmail } = params;
  const existing = await NotificationModel.findOne({
    queryId,
    channel,
    submissionStatus: { $in: ['SUBMITTED', 'SIMULATED', 'QUEUED'] },
  });

  if (existing) {
    return {
      notification: existing,
      sendResult: {
        success: true,
        providerMessageId: existing.providerMessageId,
        status: existing.submissionStatus,
      },
      alreadySent: true,
    };
  }

  const cfg = getConfig();
  const idempotencyKey = `${queryId}-${channel}-${uuidv4().slice(0, 8)}`;
  let sendResult: DeliveryResult['sendResult'];
  let providerName = '';

  try {
    if (channel === 'WHATSAPP') {
      const adapter = cfg.WHATSAPP_PROVIDER === 'meta'
        ? new MetaWhatsAppAdapter()
        : new MockWhatsAppAdapter();
      providerName = adapter.name;
      const phone = recipientPhone || patient.phone;

      sendResult = phone
        ? await adapter.send({
            to: phone,
            message: messageText,
            patientName: patient.name,
            claimId,
            idempotencyKey,
          })
        : { success: false, status: 'NOT_CONFIGURED', errorMessage: 'Patient phone number is missing.' };
    } else {
      const adapter = cfg.EMAIL_PROVIDER === 'smtp'
        ? new SmtpEmailAdapter()
        : new MockEmailAdapter();
      providerName = adapter.name;
      const email = recipientEmail || patient.email;

      sendResult = email
        ? await adapter.send({
            to: email,
            subject: 'Insurance Claim — Additional Documents Required',
            text: messageText,
            idempotencyKey,
          })
        : { success: false, status: 'NOT_CONFIGURED', errorMessage: 'Patient email address is missing.' };
    }
  } catch (error) {
    sendResult = {
      success: false,
      status: 'FAILED',
      errorMessage: error instanceof Error ? error.message : 'Provider request failed.',
    };
  }

  const notification = await NotificationModel.create({
    notificationId: `NTF-${uuidv4().slice(0, 8).toUpperCase()}`,
    patientId: patient.patientId,
    claimId,
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
    actor,
    action: 'NOTIFICATION_SENT',
    resourceType: 'Notification',
    resourceId: notification.notificationId,
    metadata: {
      queryId,
      channel,
      provider: providerName,
      status: sendResult.status,
      hasRealMessageId: !!sendResult.providerMessageId,
    },
  });

  return { notification, sendResult, alreadySent: false };
}