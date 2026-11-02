/**
 * Messaging Adapter Tests
 *
 * Tests for WhatsApp and Email adapters.
 * No real API calls are made in these unit tests.
 */

import { MockWhatsAppAdapter } from '../../adapters/whatsapp/MockWhatsAppAdapter';
import { GupshupWhatsAppAdapter } from '../../adapters/whatsapp/GupshupWhatsAppAdapter';

const MOCK_PAYLOAD = {
  to: '+919876500001',
  message: 'Dear Aarav, please submit the following documents...',
  idempotencyKey: 'test-key-001',
};

describe('MockWhatsAppAdapter', () => {
  const adapter = new MockWhatsAppAdapter();

  test('is always configured', () => {
    expect(adapter.isConfigured).toBe(true);
  });

  test('returns SIMULATED status — never SUBMITTED', async () => {
    const result = await adapter.send(MOCK_PAYLOAD);
    expect(result.status).toBe('SIMULATED');
    expect(result.success).toBe(true);
  });

  test('never sets a real providerMessageId', async () => {
    const result = await adapter.send(MOCK_PAYLOAD);
    // providerMessageId must be undefined for mock — no real ID
    expect(result.providerMessageId).toBeUndefined();
  });

  test('rawResponse contains adapter name and simulation notice', async () => {
    const result = await adapter.send(MOCK_PAYLOAD);
    expect(result.rawResponse).toBeDefined();
    const raw = result.rawResponse as Record<string, string>;
    expect(raw.adapter).toBe('MockWhatsAppAdapter');
    expect(raw.note).toContain('simulated');
  });

  test('testConnection returns connected:true with demo notice', async () => {
    const status = await adapter.testConnection();
    expect(status.connected).toBe(true);
    expect(status.details).toContain('Mock');
  });

  test('handles duplicate idempotency keys (mock always succeeds)', async () => {
    const r1 = await adapter.send({ ...MOCK_PAYLOAD, idempotencyKey: 'dup-key' });
    const r2 = await adapter.send({ ...MOCK_PAYLOAD, idempotencyKey: 'dup-key' });
    expect(r1.status).toBe('SIMULATED');
    expect(r2.status).toBe('SIMULATED');
  });
});

describe('GupshupWhatsAppAdapter (Placeholder)', () => {
  const adapter = new GupshupWhatsAppAdapter();

  test('is NOT configured', () => {
    expect(adapter.isConfigured).toBe(false);
  });

  test('returns NOT_CONFIGURED — never simulates sending', async () => {
    const result = await adapter.send(MOCK_PAYLOAD);
    expect(result.status).toBe('NOT_CONFIGURED');
    expect(result.success).toBe(false);
  });

  test('testConnection returns connected:false with explanation', async () => {
    const status = await adapter.testConnection();
    expect(status.connected).toBe(false);
    expect(status.details).toContain('placeholder');
  });
});

describe('MetaWhatsAppAdapter — no credentials (unit test)', () => {
  beforeEach(() => {
    // Ensure Meta env vars are NOT set for this test
    delete process.env.META_ACCESS_TOKEN;
    delete process.env.META_PHONE_NUMBER_ID;
  });

  test('returns NOT_CONFIGURED when credentials missing', async () => {
    // Reset config cache
    const { _resetConfig } = require('../../lib/env');
    _resetConfig();

    process.env.NODE_ENV = 'test';
    process.env.WHATSAPP_PROVIDER = 'mock';
    process.env.DRIVE_PROVIDER = 'demo';

    const { MetaWhatsAppAdapter } = require('../../adapters/whatsapp/MetaWhatsAppAdapter');
    const adapter = new MetaWhatsAppAdapter();

    expect(adapter.isConfigured).toBe(false);
    const result = await adapter.send(MOCK_PAYLOAD);
    expect(result.status).toBe('NOT_CONFIGURED');
    expect(result.success).toBe(false);
    expect(result.errorMessage).toContain('META_ACCESS_TOKEN');
  });
});

describe('Notification Generator', () => {
  const { generateNotification } = require('../../services/notificationGenerator');

  const mockRequirements = [
    {
      _id: 'req-001',
      requirementId: 'REQ-001',
      originalText: "Treating doctor's prescription",
      normalizedCategory: 'PRESCRIPTION',
    },
    {
      _id: 'req-002',
      requirementId: 'REQ-002',
      originalText: 'Investigation reports',
      normalizedCategory: 'INVESTIGATION_REPORT',
    },
  ];

  const mockMatchResults = [
    { requirementId: 'req-001', status: 'MISSING', confidence: 0, matchReason: 'No match', evidence: 'None' },
    { requirementId: 'req-002', status: 'MISSING', confidence: 0, matchReason: 'No match', evidence: 'None' },
  ];

  test('generates message with only MISSING documents listed', () => {
    const result = generateNotification({
      patientName: 'Aarav Sharma',
      hospitalName: 'Demo Hospital',
      requirements: mockRequirements,
      matchResults: mockMatchResults,
    });

    expect(result.missingDocuments).toHaveLength(2);
    expect(result.message).toContain('Aarav Sharma');
    expect(result.message).toContain("Treating doctor's prescription");
    expect(result.message).toContain('Investigation reports');
    expect(result.message).toContain('Demo Hospital');
  });

  test('does NOT list matched documents as missing', () => {
    const partialMatch = [
      { requirementId: 'req-001', status: 'MATCHED', confidence: 0.9, matchReason: 'Matched', evidence: 'Found' },
      { requirementId: 'req-002', status: 'MISSING', confidence: 0, matchReason: 'No match', evidence: 'None' },
    ];
    const result = generateNotification({
      patientName: 'Aarav Sharma',
      hospitalName: 'Demo Hospital',
      requirements: mockRequirements,
      matchResults: partialMatch,
    });
    expect(result.missingDocuments).toHaveLength(1);
    expect(result.missingDocuments[0]).toContain('Investigation reports');
  });

  test('generates all-clear message when nothing is missing', () => {
    const allMatched = mockRequirements.map((r) => ({
      requirementId: r._id,
      status: 'MATCHED',
      confidence: 0.9,
      matchReason: 'Match',
      evidence: 'Found',
    }));
    const result = generateNotification({
      patientName: 'Aarav Sharma',
      hospitalName: 'Demo Hospital',
      requirements: mockRequirements,
      matchResults: allMatched,
    });
    expect(result.missingDocuments).toHaveLength(0);
    expect(result.message).toContain('All required documents');
  });

  test('includes contact instruction only when real contact is configured', () => {
    const withContact = generateNotification({
      patientName: 'Aarav Sharma',
      hospitalName: 'Demo Hospital',
      supportEmail: 'support@demohospital.local',
      requirements: mockRequirements,
      matchResults: mockMatchResults,
    });
    expect(withContact.message).toContain('support@demohospital.local');

    const withoutContact = generateNotification({
      patientName: 'Aarav Sharma',
      hospitalName: 'Demo Hospital',
      requirements: mockRequirements,
      matchResults: mockMatchResults,
    });
    expect(withoutContact.contactInstruction).toBeFalsy();
  });
});
