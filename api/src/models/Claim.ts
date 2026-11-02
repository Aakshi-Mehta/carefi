import { Schema, model, Document } from 'mongoose';

export type ClaimStatus =
  | 'OPEN'
  | 'QUERY_RECEIVED'
  | 'DOCUMENTS_PENDING'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'CLOSED';

export interface IClaim extends Document {
  claimId: string;
  patientId: string;
  insurer: string;
  hospital: string;
  status: ClaimStatus;
  admissionDate?: Date;
  dischargeDate?: Date;
  totalAmount?: number;
  createdAt: Date;
  updatedAt: Date;
}

const claimSchema = new Schema<IClaim>(
  {
    claimId: { type: String, required: true, unique: true, index: true, trim: true },
    patientId: { type: String, required: true, index: true, trim: true },
    insurer: { type: String, required: true, trim: true },
    hospital: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ['OPEN', 'QUERY_RECEIVED', 'DOCUMENTS_PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CLOSED'],
      default: 'OPEN',
    },
    admissionDate: { type: Date },
    dischargeDate: { type: Date },
    totalAmount: { type: Number },
  },
  { timestamps: true }
);

claimSchema.index({ patientId: 1, status: 1 });

export default model<IClaim>('Claim', claimSchema);
