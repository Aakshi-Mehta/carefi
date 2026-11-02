/**
 * DemoDriveAdapter
 *
 * Returns clearly synthetic demo documents.
 * Used when DRIVE_PROVIDER=demo or when Google credentials are not configured.
 * All data is clearly labeled as DEMO/synthetic.
 * Never presents demo documents as real Drive files.
 */

import type { DriveProvider, DriveFile } from './DriveProvider';

const DEMO_FILES: DriveFile[] = [
  {
    id: 'demo-file-001',
    name: 'Discharge_Summary_Aarav_Sharma.pdf',
    mimeType: 'application/pdf',
    size: 45231,
    createdTime: '2024-01-15T10:00:00Z',
    modifiedTime: '2024-01-15T10:00:00Z',
  },
  {
    id: 'demo-file-002',
    name: 'Health_Insurance_Card_Aarav_Sharma.pdf',
    mimeType: 'application/pdf',
    size: 18944,
    createdTime: '2024-01-10T09:00:00Z',
    modifiedTime: '2024-01-10T09:00:00Z',
  },
  {
    id: 'demo-file-003',
    name: 'Final_Hospital_Bill_CLM5001.pdf',
    mimeType: 'application/pdf',
    size: 62108,
    createdTime: '2024-01-16T14:00:00Z',
    modifiedTime: '2024-01-16T14:00:00Z',
  },
];

export class DemoDriveAdapter implements DriveProvider {
  readonly name = 'DemoDriveAdapter';
  readonly isConfigured = true;

  async listFiles(_folderId?: string): Promise<DriveFile[]> {
    console.log('[DemoDrive] Returning synthetic demo files — not real Drive files.');
    return DEMO_FILES;
  }

  async getFileMetadata(fileId: string): Promise<DriveFile | null> {
    return DEMO_FILES.find((f) => f.id === fileId) || null;
  }

  async downloadFile(fileId: string): Promise<Buffer> {
    const file = DEMO_FILES.find((f) => f.id === fileId);
    if (!file) throw new Error(`Demo file not found: ${fileId}`);
    // Return a placeholder buffer with clear demo marker
    const content = `[DEMO DOCUMENT — NOT A REAL PATIENT FILE]\n\nFile: ${file.name}\nID: ${file.id}\n\nThis is synthetic demo content. It does not represent a real patient document.`;
    return Buffer.from(content, 'utf-8');
  }

  async testConnection(): Promise<{ connected: boolean; details: string }> {
    return {
      connected: true,
      details: 'Demo Drive adapter is active. Using synthetic demo files — NOT connected to Google Drive.',
    };
  }

  getAuthUrl(): null {
    return null; // No OAuth needed for demo
  }

  async handleOAuthCallback(_code: string): Promise<void> {
    throw new Error('OAuth callback not supported in demo mode.');
  }
}
