import { Schema, model, Document } from 'mongoose';
import type { DocumentCategory } from './Document';

export type RequirementStatus = 'PENDING' | 'MATCHED' | 'MISSING' | 'NEEDS_REVIEW' | 'UNCERTAIN';
export type ReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface IRequirement extends Document {
  requirementId: string;
  queryId: string;
  originalText: string;
  normalizedCategory: DocumentCategory;
  evidence: string;
  sourcePage?: number;
  confidence: number; // 0-1
  status: RequirementStatus;
  reviewStatus: ReviewStatus;
  reviewedBy?: string;
  reviewedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const requirementSchema = new Schema<IRequirement>(
  {
    requirementId: { type: String, required: true, unique: true, index: true },
    queryId: { type: String, required: true, index: true },
    originalText: { type: String, required: true },
    normalizedCategory: {
      type: String,
      enum: [
        'GOVERNMENT_ID', 'HEALTH_INSURANCE_CARD', 'POLICY_DOCUMENT',
        'ADMISSION_RECORD', 'DISCHARGE_SUMMARY', 'PRESCRIPTION',
        'DIAGNOSTIC_REPORT', 'LAB_REPORT', 'HOSPITAL_BILL',
        'PHARMACY_BILL', 'INVESTIGATION_REPORT', 'OTHER',
      ],
      required: true,
    },
    evidence: { type: String, required: true },
    sourcePage: { type: Number },
    confidence: { type: Number, min: 0, max: 1, required: true },
    status: {
      type: String,
      enum: ['PENDING', 'MATCHED', 'MISSING', 'NEEDS_REVIEW', 'UNCERTAIN'],
      default: 'PENDING',
    },
    reviewStatus: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED'],
      default: 'PENDING',
    },
    reviewedBy: { type: String },
    reviewedAt: { type: Date },
  },
  { timestamps: true }
);

requirementSchema.index({ queryId: 1, status: 1 });

export default model<IRequirement>('Requirement', requirementSchema);
