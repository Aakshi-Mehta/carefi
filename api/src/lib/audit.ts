import AuditLog from '../models/AuditLog';

export type AuditAction =
  | 'PATIENT_CREATED'
  | 'PATIENT_UPDATED'
  | 'CLAIM_CREATED'
  | 'DOCUMENT_UPLOADED'
  | 'DOCUMENT_VERIFIED'
  | 'QUERY_UPLOADED'
  | 'REQUIREMENTS_EXTRACTED'
  | 'DOCUMENT_MATCHED'
  | 'NOTIFICATION_GENERATED'
  | 'NOTIFICATION_SENT'
  | 'DELIVERY_CALLBACK'
  | 'INTEGRATION_ERROR'
  | 'USER_LOGIN'
  | 'USER_CREATED'
  | 'REQUIREMENTS_APPROVED'
  | 'REQUIREMENT_REVIEWED';

export async function writeAudit(params: {
  actor: string;
  action: AuditAction;
  resourceType: string;
  resourceId: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await AuditLog.create({
      actor: params.actor,
      action: params.action,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      timestamp: new Date(),
      metadata: params.metadata || {},
    });
  } catch (err) {
    // Audit failures must never crash the main request
    console.error('[Audit] Failed to write audit log:', (err as Error).message);
  }
}
