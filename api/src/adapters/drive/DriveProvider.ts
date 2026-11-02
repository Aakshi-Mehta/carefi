export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: number;
  createdTime?: string;
  modifiedTime?: string;
  webViewLink?: string; // Only for authorized users — not public
}

export interface DriveProvider {
  readonly name: string;
  readonly isConfigured: boolean;
  listFiles(folderId?: string): Promise<DriveFile[]>;
  getFileMetadata(fileId: string): Promise<DriveFile | null>;
  downloadFile(fileId: string): Promise<Buffer>;
  testConnection(): Promise<{ connected: boolean; details: string }>;
  getAuthUrl(): string | null;
  handleOAuthCallback(code: string): Promise<void>;
}
