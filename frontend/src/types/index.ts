// Shared TypeScript types — mirrors the backend models

export type UserRole = 'admin' | 'staff' | 'reviewer';

export interface User {
  userId: string;
  email: string;
  name: string;
  role: UserRole;
}

export interface Patient {
  _id: string;
  patientId: string;
  name: string;
  phone: string;
  email: string;
  dateOfBirth?: string;
  createdAt: string;
  updatedAt: string;
}

export type ClaimStatus = 'OPEN' | 'QUERY_RECEIVED' | 'DOCUMENTS_PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'CLOSED';

export interface Claim {
  _id: string;
  claimId: string;
  patientId: string;
  insurer: string;
  hospital: string;
  status: ClaimStatus;
  admissionDate?: string;
  dischargeDate?: string;
  totalAmount?: number;
  createdAt: string;
  updatedAt: string;
}

export type DocumentCategory =
  | 'GOVERNMENT_ID' | 'HEALTH_INSURANCE_CARD' | 'POLICY_DOCUMENT'
  | 'ADMISSION_RECORD' | 'DISCHARGE_SUMMARY' | 'PRESCRIPTION'
  | 'DIAGNOSTIC_REPORT' | 'LAB_REPORT' | 'HOSPITAL_BILL'
  | 'PHARMACY_BILL' | 'INVESTIGATION_REPORT' | 'OTHER';

export type DocumentSource = 'UPLOAD' | 'GOOGLE_DRIVE' | 'DEMO';
export type VerificationStatus = 'UNVERIFIED' | 'VERIFIED' | 'REJECTED';

export interface PatientDocument {
  _id: string;
  documentId: string;
  patientId: string;
  claimId?: string;
  fileName: string;
  category: DocumentCategory;
  mimeType: string;
  source: DocumentSource;
  driveFileId?: string;
  extractedText?: string;
  verificationStatus: VerificationStatus;
  fileSize?: number;
  uploadedBy?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type ExtractionStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'NEEDS_REVIEW';
export type MatchingStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface Query {
  _id: string;
  queryId: string;
  patientId: string;
  claimId: string;
  originalFileName: string;
  originalText: string;
  pageCount?: number;
  ocrUsed: boolean;
  extractionStatus: ExtractionStatus;
  matchingStatus: MatchingStatus;
  uploadedBy: string;
  createdAt: string;
  updatedAt: string;
}

export type RequirementStatus = 'PENDING' | 'MATCHED' | 'MISSING' | 'NEEDS_REVIEW' | 'UNCERTAIN';
export type ReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type MatchStatus = 'MATCHED' | 'MISSING' | 'NEEDS_REVIEW' | 'UNVERIFIED' | 'UNAVAILABLE';

export interface Requirement {
  _id: string;
  requirementId: string;
  queryId: string;
  originalText: string;
  normalizedCategory: DocumentCategory;
  evidence: string;
  sourcePage?: number;
  confidence: number;
  status: RequirementStatus;
  reviewStatus: ReviewStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Match {
  _id: string;
  requirementId: string;
  documentId?: string;
  matchReason: string;
  evidence: string;
  confidence: number;
  status: MatchStatus;
  createdAt: string;
  updatedAt: string;
}

export type NotificationChannel = 'WHATSAPP' | 'EMAIL';
export type SubmissionStatus = 'NOT_CONFIGURED' | 'SIMULATED' | 'QUEUED' | 'SUBMITTED' | 'FAILED';
export type DeliveryStatus = 'NOT_CONFIGURED' | 'SIMULATED' | 'QUEUED' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';

export interface Notification {
  _id: string;
  notificationId: string;
  patientId: string;
  claimId: string;
  queryId: string;
  channel: NotificationChannel;
  provider: string;
  message: string;
  providerMessageId?: string;
  submissionStatus: SubmissionStatus;
  deliveryStatus: DeliveryStatus;
  idempotencyKey: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  _id: string;
  actor: string;
  action: string;
  resourceType: string;
  resourceId: string;
  timestamp: string;
  metadata: Record<string, unknown>;
}

export interface DashboardStats {
  totalPatients: number;
  activeClaims: number;
  pendingQueries: number;
  totalDocuments: number;
  missingDocuments: number;
  queriesNeedingReview: number;
  pendingNotifications: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: { page: number; limit: number; total: number; pages?: number };
}

export interface IntegrationStatus {
  whatsapp: { provider: string; configured: boolean; mode: string; connected: boolean; details: string };
  email: { provider: string; configured: boolean; mode: string; connected: boolean; details: string };
  drive: { provider: string; configured: boolean; mode: string; connected: boolean; details: string };
  demoMode: boolean;
}

export const DOCUMENT_CATEGORY_LABELS: Record<DocumentCategory, string> = {
  GOVERNMENT_ID: 'Government ID',
  HEALTH_INSURANCE_CARD: 'Health Insurance Card',
  POLICY_DOCUMENT: 'Policy Document',
  ADMISSION_RECORD: 'Admission Record',
  DISCHARGE_SUMMARY: 'Discharge Summary',
  PRESCRIPTION: 'Prescription',
  DIAGNOSTIC_REPORT: 'Diagnostic Report',
  LAB_REPORT: 'Lab Report',
  HOSPITAL_BILL: 'Hospital Bill',
  PHARMACY_BILL: 'Pharmacy Bill',
  INVESTIGATION_REPORT: 'Investigation Report',
  OTHER: 'Other',
};
