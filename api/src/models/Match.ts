import { Schema, model, Document } from 'mongoose';

export type MatchStatus = 'MATCHED' | 'MISSING' | 'NEEDS_REVIEW' | 'UNVERIFIED' | 'UNAVAILABLE';

export interface IMatch extends Document {
  requirementId: string;
  documentId?: string;
  matchReason: string;
  evidence: string;
  confidence: number; // 0-1
  status: MatchStatus;
  createdAt: Date;
  updatedAt: Date;
}

const matchSchema = new Schema<IMatch>(
  {
    requirementId: { type: String, required: true, index: true },
    documentId: { type: String, index: true },
    matchReason: { type: String, required: true },
    evidence: { type: String, required: true },
    confidence: { type: Number, min: 0, max: 1, required: true },
    status: {
      type: String,
      enum: ['MATCHED', 'MISSING', 'NEEDS_REVIEW', 'UNVERIFIED', 'UNAVAILABLE'],
      required: true,
    },
  },
  { timestamps: true }
);

matchSchema.index({ requirementId: 1 });

export default model<IMatch>('Match', matchSchema);
