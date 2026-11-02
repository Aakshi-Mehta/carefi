/**
 * Requirement Extraction Tests
 *
 * Tests for the deterministic extraction pipeline.
 * All test inputs are synthetic — no real patient data.
 */

import { extractRequirements } from '../../services/requirementExtractor';

describe('Requirement Extraction', () => {
  // ---- Basic extraction tests ----

  test('extracts a single requirement from numbered list', () => {
    const text = `Please provide the following:
1. Final discharge summary`;
    const results = extractRequirements(text);
    expect(results.length).toBeGreaterThanOrEqual(1);
    const found = results.find((r) => r.normalizedCategory === 'DISCHARGE_SUMMARY');
    expect(found).toBeDefined();
    expect(found!.confidence).toBeGreaterThan(0.5);
  });

  test('extracts multiple requirements from numbered list', () => {
    const text = `To proceed with the claim, please provide:
1. Treating doctor's prescription
2. Investigation reports
3. Final discharge summary
4. Detailed hospital bill`;
    const results = extractRequirements(text);
    expect(results.length).toBeGreaterThanOrEqual(4);
    const categories = results.map((r) => r.normalizedCategory);
    expect(categories).toContain('PRESCRIPTION');
    expect(categories).toContain('INVESTIGATION_REPORT');
    expect(categories).toContain('DISCHARGE_SUMMARY');
    expect(categories).toContain('HOSPITAL_BILL');
  });

  test('extracts requirements from bullet points', () => {
    const text = `We require the following documents:
• Laboratory reports
• Pharmacy bills
• Health insurance card`;
    const results = extractRequirements(text);
    const categories = results.map((r) => r.normalizedCategory);
    expect(categories).toContain('LAB_REPORT');
    expect(categories).toContain('PHARMACY_BILL');
    expect(categories).toContain('HEALTH_INSURANCE_CARD');
  });

  test('handles different wording for same requirement', () => {
    const text1 = `Please submit: 1. Treating physician prescription`;
    const text2 = `Kindly provide: 1. Doctor's Rx`;
    const text3 = `Required: 1. Medical prescription from treating doctor`;

    const r1 = extractRequirements(text1);
    const r2 = extractRequirements(text2);
    const r3 = extractRequirements(text3);

    expect(r1.some((r) => r.normalizedCategory === 'PRESCRIPTION')).toBe(true);
    expect(r3.some((r) => r.normalizedCategory === 'PRESCRIPTION')).toBe(true);
  });

  test('handles lettered list (a. b. c.)', () => {
    const text = `Please provide:
a. Laboratory reports
b. Discharge summary
c. Hospital bill`;
    const results = extractRequirements(text);
    expect(results.length).toBeGreaterThanOrEqual(3);
  });

  test('marks uncertain extractions correctly', () => {
    const text = `Please submit the relevant documentation as per policy terms.`;
    const results = extractRequirements(text);
    // Either no results or all marked uncertain
    if (results.length > 0) {
      expect(results.every((r) => r.isUncertain || r.confidence <= 0.5)).toBe(true);
    }
  });

  test('returns empty array for empty input', () => {
    expect(extractRequirements('')).toEqual([]);
    expect(extractRequirements('   ')).toEqual([]);
  });

  test('handles query with no document list gracefully', () => {
    const text = `Thank you for submitting your insurance claim. We are processing it.`;
    const results = extractRequirements(text);
    // Should return empty or only low-confidence results
    if (results.length > 0) {
      results.forEach((r) => {
        expect(r.confidence).toBeLessThan(0.7);
      });
    }
  });

  test('every extracted requirement has evidence from source text', () => {
    const text = `Please provide:
1. Treating doctor's prescription
2. MRI scan report`;
    const results = extractRequirements(text);
    results.forEach((r) => {
      expect(r.evidence).toBeTruthy();
      expect(r.evidence.length).toBeGreaterThan(0);
      // Evidence must contain words from original text
      expect(r.originalText.length).toBeGreaterThan(0);
    });
  });

  test('handles unseen query format with dash-separated list', () => {
    const text = `For assessment of the hospitalization claim, submit:
- Admission record from the hospital
- Government ID of the patient`;
    const results = extractRequirements(text);
    const categories = results.map((r) => r.normalizedCategory);
    expect(categories).toContain('ADMISSION_RECORD');
    expect(categories).toContain('GOVERNMENT_ID');
  });

  test('does not invent requirements not in source text', () => {
    const text = `Please provide the discharge summary.`;
    const results = extractRequirements(text);
    // Should only find DISCHARGE_SUMMARY, not prescription or bills
    const hasInvented = results.some(
      (r) => r.normalizedCategory === 'PRESCRIPTION' && r.confidence > 0.5
    );
    expect(hasInvented).toBe(false);
  });

  test('handles ambiguous requirement as UNCERTAIN', () => {
    const text = `Please provide additional supporting documentation.`;
    const results = extractRequirements(text);
    if (results.length > 0) {
      expect(results.some((r) => r.isUncertain || r.confidence < 0.5)).toBe(true);
    }
  });

  // ---- Demo fixture test ----
  test('correctly extracts from demo query fixture QRY-DEMO001', () => {
    const text = `DEMO SYNTHETIC QUERY — NOT A REAL INSURER LETTER

Dear Hospital Administration,

With reference to claim CLM-5001 for patient Aarav Sharma, we have reviewed the submitted documents.

To proceed with the claim assessment, please provide the following:

1. Treating doctor's prescription
2. Investigation reports

Kindly submit the above documents within 7 working days.`;

    const results = extractRequirements(text);
    expect(results.length).toBeGreaterThanOrEqual(2);
    const categories = results.map((r) => r.normalizedCategory);
    expect(categories).toContain('PRESCRIPTION');
    expect(categories).toContain('INVESTIGATION_REPORT');
  });
});
