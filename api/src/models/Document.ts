import { Schema, model, Document } from 'mongoose';

export type DocumentCategory =
  | 'GOVERNMENT_ID'
  | 'HEALTH_INSURANCE_CARD'
  | 'POLICY_DOCUMENT'
  | 'ADMISSION_RECORD'
  | 'DISCHARGE_SUMMARY'
  | 'PRESCRIPTION'
  | 'DIAGNOSTIC_REPORT'
  | 'LAB_REPORT'
  | 'HOSPITAL_BILL'
  | 'PHARMACY_BILL'
  | 'INVESTIGATION_REPORT'
  | 'OTHER';

export type DocumentSource = 'UPLOAD' | 'GOOGLE_DRIVE' | 'DEMO';
export type VerificationStatus = 'UNVERIFIED' | 'VERIFIED' | 'REJECTED';

export interface IDocument extends Document {
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
  createdAt: Date;
  updatedAt: Date;
}

const documentSchema = new Schema<IDocument>(
  {
    documentId: { type: String, required: true, unique: true, index: true },
    patientId: { type: String, required: true, index: true },
    claimId: { type: String, index: true },
    fileName: { type: String, required: true },
    category: {
      type: String,
      enum: [
        'GOVERNMENT_ID', 'HEALTH_INSURANCE_CARD', 'POLICY_DOCUMENT',
        'ADMISSION_RECORD', 'DISCHARGE_SUMMARY', 'PRESCRIPTION',
        'DIAGNOSTIC_REPORT', 'LAB_REPORT', 'HOSPITAL_BILL',
        'PHARMACY_BILL', 'INVESTIGATION_REPORT', 'OTHER',
      ],
      required: true,
    },
    mimeType: { type: String, required: true },
    source: {
      type: String,
      enum: ['UPLOAD', 'GOOGLE_DRIVE', 'DEMO'],
      default: 'UPLOAD',
    },
    driveFileId: { type: String },
    extractedText: { type: String },
    verificationStatus: {
      type: String,
      enum: ['UNVERIFIED', 'VERIFIED', 'REJECTED'],
      default: 'UNVERIFIED',
    },
    fileSize: { type: Number },
    uploadedBy: { type: String },
    notes: { type: String },
  },
  { timestamps: true }
);

documentSchema.index({ patientId: 1, claimId: 1, category: 1 });
documentSchema.index({ fileName: 'text', extractedText: 'text' });

export default model<IDocument>('Document', documentSchema);
