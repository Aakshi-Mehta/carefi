/**
 * GupshupWhatsAppAdapter — PLACEHOLDER
 *
 * This adapter is not implemented. Gupshup credentials are not available.
 *
 * This file exists as a structural placeholder to demonstrate the
 * NotificationProvider interface is designed for multiple providers.
 *
 * Do not enable this adapter until Gupshup credentials are obtained
 * and the endpoint documentation is reviewed.
 */

import type { NotificationProvider, MessagePayload, SendResult } from './NotificationProvider';

export class GupshupWhatsAppAdapter implements NotificationProvider {
  readonly name = 'GupshupWhatsAppAdapter';
  readonly isConfigured = false;

  async send(_payload: MessagePayload): Promise<SendResult> {
    return {
      success: false,
      status: 'NOT_CONFIGURED',
      errorMessage:
        'Gupshup integration is not implemented. ' +
        'This is a placeholder adapter. Obtain Gupshup credentials and implement the endpoint.',
    };
  }

  async testConnection(): Promise<{ connected: boolean; details: string }> {
    return {
      connected: false,
      details: 'Gupshup adapter is a placeholder — not implemented.',
    };
  }
}
