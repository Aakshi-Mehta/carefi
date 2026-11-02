import { Schema, model, Document } from 'mongoose';

export type NotificationChannel = 'WHATSAPP' | 'EMAIL';
export type SubmissionStatus = 'NOT_CONFIGURED' | 'SIMULATED' | 'QUEUED' | 'SUBMITTED' | 'FAILED';
export type DeliveryStatus = 'NOT_CONFIGURED' | 'SIMULATED' | 'QUEUED' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';

export interface INotification extends Document {
  notificationId: string;
  patientId: string;
  claimId: string;
  queryId: string;
  channel: NotificationChannel;
  provider: string; // 'meta' | 'mock' | 'smtp' | etc.
  message: string;
  providerMessageId?: string; // Real message ID from provider — only when real
  submissionStatus: SubmissionStatus;
  deliveryStatus: DeliveryStatus;
  idempotencyKey: string; // Prevents duplicate sends
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    notificationId: { type: String, required: true, unique: true, index: true },
    patientId: { type: String, required: true, index: true },
    claimId: { type: String, required: true, index: true },
    queryId: { type: String, required: true, index: true },
    channel: { type: String, enum: ['WHATSAPP', 'EMAIL'], required: true },
    provider: { type: String, required: true },
    message: { type: String, required: true },
    providerMessageId: { type: String }, // Only set from genuine provider response
    submissionStatus: {
      type: String,
      enum: ['NOT_CONFIGURED', 'SIMULATED', 'QUEUED', 'SUBMITTED', 'FAILED'],
      default: 'NOT_CONFIGURED',
    },
    deliveryStatus: {
      type: String,
      enum: ['NOT_CONFIGURED', 'SIMULATED', 'QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED'],
      default: 'NOT_CONFIGURED',
    },
    idempotencyKey: { type: String, required: true, unique: true },
    errorMessage: { type: String },
  },
  { timestamps: true }
);

notificationSchema.index({ patientId: 1, channel: 1 });

export default model<INotification>('Notification', notificationSchema);
