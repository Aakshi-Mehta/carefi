/**
 * MockWhatsAppAdapter
 *
 * Used when WHATSAPP_PROVIDER=mock.
 * Always labels output as SIMULATED.
 * Never calls any external API.
 * Never presents simulated output as a real delivery.
 */

import type { NotificationProvider, MessagePayload, SendResult } from './NotificationProvider';

export class MockWhatsAppAdapter implements NotificationProvider {
  readonly name = 'MockWhatsAppAdapter';
  readonly isConfigured = true; // Always available — no credentials needed

  async send(payload: MessagePayload): Promise<SendResult> {
    console.log('[MockWhatsApp] SIMULATED send to:', payload.to);
    console.log('[MockWhatsApp] Message:', payload.message.slice(0, 100) + '...');
    console.log('[MockWhatsApp] Idempotency key:', payload.idempotencyKey);

    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 150));

    return {
      success: true,
      // No real providerMessageId — mock only generates a clearly fake ID
      providerMessageId: undefined,
      status: 'SIMULATED',
      rawResponse: {
        adapter: 'MockWhatsAppAdapter',
        note: 'This is a simulated response. No real WhatsApp message was sent.',
        to: payload.to,
        idempotencyKey: payload.idempotencyKey,
        simulatedAt: new Date().toISOString(),
      },
    };
  }

  async testConnection(): Promise<{ connected: boolean; details: string }> {
    return {
      connected: true,
      details: 'Mock adapter is always available. No real WhatsApp connection established.',
    };
  }
}
