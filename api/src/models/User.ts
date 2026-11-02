import { Schema, model, Document } from 'mongoose';

export type UserRole = 'admin' | 'staff' | 'reviewer';

export interface IUser extends Document {
  userId: string;
  email: string;
  passwordHash: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    userId: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    role: { type: String, enum: ['admin', 'staff', 'reviewer'], default: 'staff' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Never select passwordHash by default
userSchema.set('toJSON', {
  transform(_doc, ret) {
    const record = ret as any;
    delete record.passwordHash;
    return ret;
  },
});

export default model<IUser>('User', userSchema);
