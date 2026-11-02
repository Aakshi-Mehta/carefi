/**
 * NotificationProvider interface
 *
 * All WhatsApp/SMS adapters must implement this interface.
 * This allows switching between Meta, Mock, and future Gupshup
 * without changing query processing logic.
 */

export interface SendResult {
  success: boolean;
  /**
   * Real provider message ID — only set from genuine provider HTTP response.
   * NEVER invented or fabricated.
   */
  providerMessageId?: string;
  /**
   * Explicit status — must reflect actual outcome.
   */
  status: 'SIMULATED' | 'SUBMITTED' | 'FAILED' | 'NOT_CONFIGURED';
  errorMessage?: string;
  rawResponse?: unknown;
}

export interface MessagePayload {
  to: string; // E.164 phone number e.g. +919876543210
  message: string;
  patientName?: string;
  claimId?: string;
  /** Idempotency key — used to detect duplicate send attempts */
  idempotencyKey: string;
}

export interface NotificationProvider {
  readonly name: string;
  readonly isConfigured: boolean;
  send(payload: MessagePayload): Promise<SendResult>;
  testConnection(): Promise<{ connected: boolean; details: string }>;
}
