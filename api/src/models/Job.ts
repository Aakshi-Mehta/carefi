import { Schema, model, Document } from 'mongoose';

export type JobType = 'EXTRACT_REQUIREMENTS' | 'MATCH_DOCUMENTS' | 'SEND_NOTIFICATION' | 'OCR_PDF';
export type JobStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'NEEDS_REVIEW';

export interface IJob extends Document {
  jobId: string;
  type: JobType;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  payload: Record<string, unknown>;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const jobSchema = new Schema<IJob>(
  {
    jobId: { type: String, required: true, unique: true, index: true },
    type: {
      type: String,
      enum: ['EXTRACT_REQUIREMENTS', 'MATCH_DOCUMENTS', 'SEND_NOTIFICATION', 'OCR_PDF'],
      required: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'NEEDS_REVIEW'],
      default: 'PENDING',
    },
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 3 },
    payload: { type: Schema.Types.Mixed, required: true },
    error: { type: String },
    startedAt: { type: Date },
    completedAt: { type: Date },
  },
  { timestamps: true }
);

jobSchema.index({ status: 1, type: 1 });

export default model<IJob>('Job', jobSchema);
