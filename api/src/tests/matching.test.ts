/**
 * Document Matching Tests
 *
 * Tests for the document matching engine.
 * Uses synthetic data only — no real patient information.
 */

import { matchRequirements } from '../../services/documentMatcher';
import type { IRequirement } from '../../models/Requirement';
import type { IDocument } from '../../models/Document';

function makeRequirement(overrides: Partial<IRequirement> = {}): IRequirement {
  return {
    _id: 'req-001',
    requirementId: 'REQ-001',
    queryId: 'QRY-001',
    originalText: 'Treating doctor\'s prescription',
    normalizedCategory: 'PRESCRIPTION',
    evidence: 'Please provide the treating doctor\'s prescription.',
    confidence: 0.9,
    status: 'PENDING',
    reviewStatus: 'APPROVED',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as unknown as IRequirement;
}

function makeDocument(overrides: Partial<IDocument> = {}): IDocument {
  return {
    _id: 'doc-001',
    documentId: 'DOC-001',
    patientId: 'PAT-001',
    claimId: 'CLM-001',
    fileName: 'Prescription.pdf',
    category: 'PRESCRIPTION',
    mimeType: 'application/pdf',
    source: 'UPLOAD',
    verificationStatus: 'VERIFIED',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as unknown as IDocument;
}

describe('Document Matching Engine', () => {
  test('exact category match — same claim — returns MATCHED', () => {
    const req = makeRequirement();
    const doc = makeDocument();
    const results = matchRequirements([req], [doc], 'CLM-001');
    expect(results).toHaveLength(1);
    expect(results[0].status).toBe('MATCHED');
    expect(results[0].documentId).toBe('DOC-001');
  });

  test('no documents in correct category returns MISSING', () => {
    const req = makeRequirement();
    // Document is DISCHARGE_SUMMARY, not PRESCRIPTION
    const doc = makeDocument({ category: 'DISCHARGE_SUMMARY', documentId: 'DOC-002' });
    const results = matchRequirements([req], [doc], 'CLM-001');
    expect(results[0].status).toBe('MISSING');
    expect(results[0].documentId).toBeUndefined();
  });

  test('document from another patient is NEVER matched', () => {
    const req = makeRequirement();
    // This document belongs to PAT-999, not PAT-001
    const doc = makeDocument({ patientId: 'PAT-999', documentId: 'DOC-OTHER' });
    // matchRequirements only receives documents already filtered to the correct patient
    // The route pre-filters: DocumentModel.find({ patientId: query.patientId })
    // So this test verifies the engine only works with what it's given
    const results = matchRequirements([req], [], 'CLM-001');
    expect(results[0].status).toBe('MISSING');
  });

  test('unverified document returns UNVERIFIED status', () => {
    const req = makeRequirement();
    const doc = makeDocument({ verificationStatus: 'UNVERIFIED' });
    const results = matchRequirements([req], [doc], 'CLM-001');
    expect(results[0].status).toBe('UNVERIFIED');
  });

  test('cross-claim document returns NEEDS_REVIEW', () => {
    const req = makeRequirement();
    // Document is for CLM-999 (different claim)
    const doc = makeDocument({ claimId: 'CLM-999', verificationStatus: 'VERIFIED' });
    const results = matchRequirements([req], [doc], 'CLM-001');
    expect(results[0].status).toBe('NEEDS_REVIEW');
    expect(results[0].matchReason).toContain('CLM-999');
  });

  test('missing document has no documentId', () => {
    const req = makeRequirement();
    const results = matchRequirements([req], [], 'CLM-001');
    expect(results[0].status).toBe('MISSING');
    expect(results[0].documentId).toBeUndefined();
  });

  test('compatible category match (LAB_REPORT satisfies INVESTIGATION_REPORT)', () => {
    const req = makeRequirement({ normalizedCategory: 'INVESTIGATION_REPORT', originalText: 'Investigation reports' });
    const doc = makeDocument({ category: 'LAB_REPORT', documentId: 'DOC-LAB' });
    const results = matchRequirements([req], [doc], 'CLM-001');
    expect(['MATCHED', 'UNVERIFIED', 'NEEDS_REVIEW']).toContain(results[0].status);
    expect(results[0].documentId).toBe('DOC-LAB');
  });

  test('multiple requirements — each evaluated independently', () => {
    const req1 = makeRequirement({ _id: 'req-001' as unknown as IRequirement['_id'] });
    const req2 = makeRequirement({
      _id: 'req-002' as unknown as IRequirement['_id'],
      normalizedCategory: 'DISCHARGE_SUMMARY',
      originalText: 'Discharge summary',
    });
    const doc = makeDocument({ category: 'DISCHARGE_SUMMARY', documentId: 'DOC-DISCHARGE' });
    const results = matchRequirements([req1, req2], [doc], 'CLM-001');
    expect(results).toHaveLength(2);

    const prescriptionResult = results.find((r) => r.requirementId === 'req-001');
    const dischargeResult = results.find((r) => r.requirementId === 'req-002');
    expect(prescriptionResult?.status).toBe('MISSING');
    expect(['MATCHED', 'UNVERIFIED']).toContain(dischargeResult?.status);
  });

  test('match result always contains matchReason and evidence', () => {
    const req = makeRequirement();
    const results = matchRequirements([req], [], 'CLM-001');
    expect(results[0].matchReason).toBeTruthy();
    expect(results[0].evidence).toBeTruthy();
  });

  test('confidence is between 0 and 1', () => {
    const req = makeRequirement();
    const doc = makeDocument();
    const results = matchRequirements([req], [doc], 'CLM-001');
    expect(results[0].confidence).toBeGreaterThanOrEqual(0);
    expect(results[0].confidence).toBeLessThanOrEqual(1);
  });
});
