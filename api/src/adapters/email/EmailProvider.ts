export interface EmailPayload {
  to: string;
  subject: string;
  text: string;
  html?: string;
  idempotencyKey: string;
}

export interface EmailSendResult {
  success: boolean;
  providerMessageId?: string;
  status: 'SIMULATED' | 'SUBMITTED' | 'FAILED' | 'NOT_CONFIGURED';
  errorMessage?: string;
}

export interface EmailProvider {
  readonly name: string;
  readonly isConfigured: boolean;
  send(payload: EmailPayload): Promise<EmailSendResult>;
  testConnection(): Promise<{ connected: boolean; details: string }>;
}
