import { Schema, model, Document } from 'mongoose';

export type ExtractionStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'NEEDS_REVIEW';
export type MatchingStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface IQuery extends Document {
  queryId: string;
  patientId: string;
  claimId: string;
  originalFileName: string;
  originalText: string;
  storageFileId?: string;
  pageCount?: number;
  ocrUsed: boolean;
  extractionStatus: ExtractionStatus;
  matchingStatus: MatchingStatus;
  uploadedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const querySchema = new Schema<IQuery>(
  {
    queryId: { type: String, required: true, unique: true, index: true },
    patientId: { type: String, required: true, index: true },
    claimId: { type: String, required: true, index: true },
    originalFileName: { type: String, required: true },
    originalText: { type: String, required: true },
    storageFileId: { type: String },
    pageCount: { type: Number },
    ocrUsed: { type: Boolean, default: false },
    extractionStatus: {
      type: String,
      enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'NEEDS_REVIEW'],
      default: 'PENDING',
    },
    matchingStatus: {
      type: String,
      enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'],
      default: 'PENDING',
    },
    uploadedBy: { type: String, required: true },
  },
  { timestamps: true }
);

querySchema.index({ patientId: 1, claimId: 1 });

export default model<IQuery>('Query', querySchema);
