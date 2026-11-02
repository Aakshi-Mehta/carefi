import type { EmailProvider, EmailPayload, EmailSendResult } from './EmailProvider';

export class MockEmailAdapter implements EmailProvider {
  readonly name = 'MockEmailAdapter';
  readonly isConfigured = true;

  async send(payload: EmailPayload): Promise<EmailSendResult> {
    console.log('[MockEmail] SIMULATED email; no external send occurred.');

    await new Promise((resolve) => setTimeout(resolve, 100));

    return {
      success: true,
      providerMessageId: undefined,
      status: 'SIMULATED',
    };
  }

  async testConnection(): Promise<{ connected: boolean; details: string }> {
    return {
      connected: true,
      details: 'Mock email adapter is always available. No real email sent.',
    };
  }
}
