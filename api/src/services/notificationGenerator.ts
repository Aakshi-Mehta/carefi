/**
 * Patient Notification Generator
 *
 * Generates a polite, concise patient message listing only genuinely missing documents.
 * Uses a fixed template — no AI generation required.
 * Only includes documents confirmed as MISSING by the matching engine.
 * Never includes unverified assumptions.
 */

import type { IRequirement } from '../models/Requirement';
import type { MatchResult } from './documentMatcher';

export interface GeneratedNotification {
  message: string;
  missingDocuments: string[];
  patientName: string;
  hospitalName: string;
  contactInstruction?: string;
}

export function generateNotification(params: {
  patientName: string;
  hospitalName: string;
  supportEmail?: string;
  supportPhone?: string;
  requirements: IRequirement[];
  matchResults: MatchResult[];
}): GeneratedNotification {
  const { patientName, hospitalName, supportEmail, supportPhone, requirements, matchResults } = params;

  // Only list documents where match status is MISSING
  const missingRequirementIds = new Set(
    matchResults
      .filter((m) => m.status === 'MISSING')
      .map((m) => m.requirementId)
  );

  const missingRequirements = requirements.filter((r) =>
    missingRequirementIds.has(String(r._id))
  );

  const missingDocuments = missingRequirements.map((r) => {
    // Use original text for patient message — more readable than category code
    return r.originalText.trim();
  });

  if (missingDocuments.length === 0) {
    return {
      message: `Dear ${patientName},\n\nThank you. All required documents for your insurance claim have been received.\n\nWe will update you once your claim is processed.\n\nThank you,\n${hospitalName}`,
      missingDocuments: [],
      patientName,
      hospitalName,
    };
  }

  // Build contact instruction only if a real contact is configured
  let contactInstruction = '';
  if (supportEmail || supportPhone) {
    const parts: string[] = [];
    if (supportPhone) parts.push(`call us at ${supportPhone}`);
    if (supportEmail) parts.push(`email us at ${supportEmail}`);
    contactInstruction = `If you have any questions, please ${parts.join(' or ')}.`;
  }

  const documentList = missingDocuments
    .map((doc, i) => `${i + 1}. ${doc}`)
    .join('\n');

  const message = [
    `Dear ${patientName},`,
    '',
    'We require a few additional documents to proceed with your insurance claim.',
    '',
    'Please share the following documents:',
    '',
    documentList,
    '',
    'Kindly submit these documents at your earliest convenience.',
    '',
    ...(contactInstruction ? [contactInstruction, ''] : []),
    'Thank you,',
    hospitalName,
  ].join('\n');

  return {
    message,
    missingDocuments,
    patientName,
    hospitalName,
    contactInstruction,
  };
}
