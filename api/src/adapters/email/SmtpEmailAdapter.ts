import nodemailer from 'nodemailer';
import type { EmailProvider, EmailPayload, EmailSendResult } from './EmailProvider';
import { getConfig } from '../../lib/env';

export class SmtpEmailAdapter implements EmailProvider {
  readonly name = 'SmtpEmailAdapter';

  get isConfigured(): boolean {
    const cfg = getConfig();
    return !!(cfg.EMAIL_HOST && cfg.EMAIL_USER && cfg.EMAIL_PASS);
  }

  private createTransport() {
    const cfg = getConfig();
    return nodemailer.createTransport({
      host: cfg.EMAIL_HOST,
      port: cfg.EMAIL_PORT || 587,
      secure: cfg.EMAIL_SECURE || false,
      auth: {
        user: cfg.EMAIL_USER,
        pass: cfg.EMAIL_PASS,
      },
    });
  }

  async send(payload: EmailPayload): Promise<EmailSendResult> {
    if (!this.isConfigured) {
      return {
        success: false,
        status: 'NOT_CONFIGURED',
        errorMessage: 'EMAIL_HOST, EMAIL_USER, and EMAIL_PASS must be configured.',
      };
    }

    const cfg = getConfig();
    const transporter = this.createTransport();

    try {
      const info = await transporter.sendMail({
        from: cfg.EMAIL_FROM,
        to: payload.to,
        subject: payload.subject,
        text: payload.text,
        html: payload.html,
        headers: {
          'X-Idempotency-Key': payload.idempotencyKey,
        },
      });

      return {
        success: true,
        providerMessageId: info.messageId,
        status: 'SUBMITTED',
      };
    } catch (err) {
      return {
        success: false,
        status: 'FAILED',
        errorMessage: `SMTP send failed: ${(err as Error).message}`,
      };
    }
  }

  async testConnection(): Promise<{ connected: boolean; details: string }> {
    if (!this.isConfigured) {
      return { connected: false, details: 'Not configured. Set EMAIL_HOST, EMAIL_USER, EMAIL_PASS.' };
    }

    const transporter = this.createTransport();
    try {
      await transporter.verify();
      return { connected: true, details: 'SMTP connection verified successfully.' };
    } catch (err) {
      return { connected: false, details: `SMTP verification failed: ${(err as Error).message}` };
    }
  }
}
