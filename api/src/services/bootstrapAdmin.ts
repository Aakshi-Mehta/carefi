import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import User from '../models/User';

export async function ensureBootstrapAdmin(config: {
  email?: string;
  password?: string;
  name?: string;
}): Promise<void> {
  const existingAdmin = await User.findOne({ role: 'admin' });
  if (existingAdmin) return;

  const { email, password, name } = config;
  if (!email || !password || !name) {
    throw new Error(
      'No administrator exists. Configure BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_PASSWORD, and BOOTSTRAP_ADMIN_NAME for the first production startup.'
    );
  }
  if (password.length < 16) {
    throw new Error('BOOTSTRAP_ADMIN_PASSWORD must be at least 16 characters');
  }

  const normalizedEmail = email.trim().toLowerCase();
  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    throw new Error('BOOTSTRAP_ADMIN_EMAIL is already assigned to a non-admin user.');
  }

  await User.create({
    userId: `USR-${uuidv4().slice(0, 8).toUpperCase()}`,
    email: normalizedEmail,
    passwordHash: await bcrypt.hash(password, 12),
    name: name.trim(),
    role: 'admin',
  });

  console.log('[Bootstrap] Initial administrator account created.');
}