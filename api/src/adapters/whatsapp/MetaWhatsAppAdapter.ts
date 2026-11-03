/**
 * MetaWhatsAppAdapter
 *
 * Sends messages via Meta WhatsApp Cloud API (Graph API).
 * Official documentation: https://developers.facebook.com/docs/whatsapp/cloud-api/
 *
 * IMPORTANT:
 * - Only sends if META_ACCESS_TOKEN, META_PHONE_NUMBER_ID are configured.
 * - Uses an approved template for business-initiated notifications.
 * - Does NOT claim delivery unless an authenticated webhook confirms it.
 * - The test number only supports verified test recipients.
 * - No billing is enabled. Free developer test environment only.
 */

import axios from 'axios';
import type { NotificationProvider, MessagePayload, SendResult } from './NotificationProvider';
import { getConfig } from '../../lib/env';

interface MetaApiResponse {
  messaging_product: string;
  contacts?: Array<{ input: string; wa_id: string }>;
  messages?: Array<{ id: string; message_status: string }>;
  error?: {
    message: string;
    type: string;
    code: number;
    fbtrace_id: string;
  };
}

export class MetaWhatsAppAdapter implements NotificationProvider {
  readonly name = 'MetaWhatsAppAdapter';

  get isConfigured(): boolean {
    const cfg = getConfig();
    return !!(cfg.META_ACCESS_TOKEN && cfg.META_PHONE_NUMBER_ID && cfg.META_MESSAGE_TEMPLATE_NAME);
  }

  async send(payload: MessagePayload): Promise<SendResult> {
    if (!this.isConfigured) {
      return {
        success: false,
        status: 'NOT_CONFIGURED',
        errorMessage:
          'META_ACCESS_TOKEN, META_PHONE_NUMBER_ID, and META_MESSAGE_TEMPLATE_NAME must be configured. ' +
          'See INTEGRATIONS.md for setup instructions.',
      };
    }

    const cfg = getConfig();
    const apiVersion = cfg.META_GRAPH_API_VERSION;
    const phoneNumberId = cfg.META_PHONE_NUMBER_ID;
    const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;

    if (payload.message.length > 1024) {
      return {
        success: false,
        status: 'FAILED',
        errorMessage: 'The notification is too long for the configured WhatsApp template parameter.',
      };
    }

    try {
      const requestBody = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: payload.to,
        type: 'template',
        template: {
          name: cfg.META_MESSAGE_TEMPLATE_NAME,
          language: { code: cfg.META_MESSAGE_TEMPLATE_LANGUAGE },
          components: [{
            type: 'body',
            parameters: [{ type: 'text', text: payload.message }],
          }],
        },
      };

      const response = await axios.post<MetaApiResponse>(url, requestBody, {
        headers: {
          Authorization: `Bearer ${cfg.META_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      });

      const data = response.data;

      if (data.error) {
        return {
          success: false,
          status: 'FAILED',
          errorMessage: `Meta API error: ${data.error.message} (code: ${data.error.code})`,
          rawResponse: data,
        };
      }

      const realMessageId = data.messages?.[0]?.id;

      return {
        success: true,
        // Only set providerMessageId from actual API response — never invented
        providerMessageId: realMessageId,
        status: 'SUBMITTED',
        rawResponse: data,
      };
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const errorData = err.response?.data as MetaApiResponse | undefined;
        const errorMessage = errorData?.error?.message || err.message;

        // Check for billing-related errors and report honestly
        if (err.response?.status === 400 && errorData?.error?.code === 131030) {
          return {
            success: false,
            status: 'FAILED',
            errorMessage:
              'Recipient phone number is not in the permitted test recipients list. ' +
              'Add the number in the Meta Developer Console > WhatsApp > API Setup > Test recipients.',
            rawResponse: errorData,
          };
        }

        return {
          success: false,
          status: 'FAILED',
          errorMessage: `Meta API request failed: ${errorMessage}`,
          rawResponse: errorData,
        };
      }

      return {
        success: false,
        status: 'FAILED',
        errorMessage: `Unexpected error: ${(err as Error).message}`,
      };
    }
  }

  async testConnection(): Promise<{ connected: boolean; details: string }> {
    if (!this.isConfigured) {
      return {
        connected: false,
        details: 'Not configured. Set META_ACCESS_TOKEN and META_PHONE_NUMBER_ID.',
      };
    }

    const cfg = getConfig();
    const url = `https://graph.facebook.com/${cfg.META_GRAPH_API_VERSION}/${cfg.META_PHONE_NUMBER_ID}`;

    try {
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${cfg.META_ACCESS_TOKEN}` },
        timeout: 10000,
      });

      const data = response.data as { display_phone_number?: string; verified_name?: string };
      return {
        connected: true,
        details: `Connected. Phone: ${data.display_phone_number || 'unknown'}, Name: ${data.verified_name || 'unknown'}`,
      };
    } catch (err) {
      const msg = axios.isAxiosError(err)
        ? (err.response?.data as { error?: { message?: string } })?.error?.message || err.message
        : (err as Error).message;
      return { connected: false, details: `Connection test failed: ${msg}` };
    }
  }
}
