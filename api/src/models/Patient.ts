import { Schema, model, Document, Types } from 'mongoose';

export interface IPatient extends Document {
  patientId: string;
  name: string;
  phone: string;
  email: string;
  dateOfBirth?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const patientSchema = new Schema<IPatient>(
  {
    patientId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    dateOfBirth: { type: Date },
  },
  { timestamps: true }
);

patientSchema.index({ name: 'text', email: 'text', patientId: 'text' });

export default model<IPatient>('Patient', patientSchema);
