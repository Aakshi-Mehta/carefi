import { GridFSBucket, ObjectId } from 'mongodb';
import mongoose from 'mongoose';

const BUCKET_NAME = 'patientFiles';

function getBucket(): GridFSBucket {
  const database = mongoose.connection.db;
  if (!database) throw new Error('MongoDB is not connected.');
  return new GridFSBucket(database, { bucketName: BUCKET_NAME });
}

export async function storePatientFile(params: {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
  metadata: Record<string, string>;
}): Promise<string> {
  const upload = getBucket().openUploadStream(params.fileName, {
    contentType: params.mimeType,
    metadata: params.metadata,
  });

  return new Promise((resolve, reject) => {
    upload.once('error', reject);
    upload.once('finish', () => resolve(upload.id.toString()));
    upload.end(params.buffer);
  });
}

export function openPatientFile(storageFileId: string) {
  if (!ObjectId.isValid(storageFileId)) throw new Error('Invalid stored file identifier.');
  return getBucket().openDownloadStream(new ObjectId(storageFileId));
}