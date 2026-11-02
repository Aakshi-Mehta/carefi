import mongoose from 'mongoose';

let isConnected = false;

export async function connectDB(uri: string): Promise<void> {
  if (isConnected) return;

  mongoose.set('strictQuery', true);

  await mongoose.connect(uri, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  });

  isConnected = true;
  console.log('[DB] Connected to MongoDB');

  mongoose.connection.on('error', (err) => {
    console.error('[DB] MongoDB connection error:', err.message);
    isConnected = false;
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('[DB] MongoDB disconnected');
    isConnected = false;
  });
}

export function getConnectionStatus(): boolean {
  return isConnected;
}
