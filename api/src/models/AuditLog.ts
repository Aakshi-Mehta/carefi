import { Schema, model, Document } from 'mongoose';
import { AuditAction } from '../lib/audit';

export interface IAuditLog extends Document {
  actor: string;
  action: AuditAction;
  resourceType: string;
  resourceId: string;
  timestamp: Date;
  metadata: Record<string, unknown>;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    actor: { type: String, required: true, index: true },
    action: { type: String, required: true, index: true },
    resourceType: { type: String, required: true },
    resourceId: { type: String, required: true, index: true },
    timestamp: { type: Date, required: true, index: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: false }
);

auditLogSchema.index({ timestamp: -1 });
auditLogSchema.index({ actor: 1, timestamp: -1 });

export default model<IAuditLog>('AuditLog', auditLogSchema);
