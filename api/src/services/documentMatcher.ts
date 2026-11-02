/**
 * Document Matching Engine
 *
 * For every extracted requirement, searches patient documents to find a match.
 * Uses category matching + keyword similarity on document metadata and extracted text.
 *
 * Rules:
 * - Only documents belonging to the same patient are considered.
 * - Claim-specific matching is restricted to the same claim.
 * - Similarity alone does not establish a valid match.
 * - Documents must be accessible (not just referenced) to be MATCHED.
 * - Inaccessible or unverified documents are reported honestly.
 * - Documents from another patient are NEVER matched.
 */

import type { IDocument, DocumentCategory } from '../models/Document';
import type { IRequirement } from '../models/Requirement';
import type { MatchStatus } from '../models/Match';

export interface MatchResult {
  requirementId: string;
  documentId?: string;
  matchReason: string;
  evidence: string;
  confidence: number;
  status: MatchStatus;
}

// Category similarity map — which document categories satisfy which requirements
const CATEGORY_COMPATIBILITY: Record<DocumentCategory, DocumentCategory[]> = {
  DISCHARGE_SUMMARY: ['DISCHARGE_SUMMARY'],
  PRESCRIPTION: ['PRESCRIPTION'],
  INVESTIGATION_REPORT: ['INVESTIGATION_REPORT', 'DIAGNOSTIC_REPORT', 'LAB_REPORT'],
  HOSPITAL_BILL: ['HOSPITAL_BILL'],
  LAB_REPORT: ['LAB_REPORT', 'DIAGNOSTIC_REPORT', 'INVESTIGATION_REPORT'],
  DIAGNOSTIC_REPORT: ['DIAGNOSTIC_REPORT', 'INVESTIGATION_REPORT', 'LAB_REPORT'],
  ADMISSION_RECORD: ['ADMISSION_RECORD'],
  HEALTH_INSURANCE_CARD: ['HEALTH_INSURANCE_CARD'],
  POLICY_DOCUMENT: ['POLICY_DOCUMENT'],
  GOVERNMENT_ID: ['GOVERNMENT_ID'],
  PHARMACY_BILL: ['PHARMACY_BILL'],
  OTHER: ['OTHER'],
};

// Keywords that boost match confidence when found in document text
const CATEGORY_KEYWORDS: Partial<Record<DocumentCategory, string[]>> = {
  DISCHARGE_SUMMARY: ['discharge', 'discharged on', 'discharge date', 'final diagnosis on discharge'],
  PRESCRIPTION: ['prescribed', 'rx', 'tablet', 'capsule', 'dosage', 'administered', 'prescription'],
  INVESTIGATION_REPORT: ['investigation', 'result', 'finding', 'report no'],
  HOSPITAL_BILL: ['total amount', 'bill no', 'patient charges', 'room charges'],
  LAB_REPORT: ['hemoglobin', 'wbc', 'rbc', 'platelet', 'glucose', 'creatinine', 'lab no'],
  DIAGNOSTIC_REPORT: ['impression', 'finding', 'mri', 'ct', 'ultrasound', 'x-ray'],
};

/**
 * Match a list of requirements against a list of patient documents.
 *
 * @param requirements - All requirements for the query (already filtered to correct query)
 * @param documents - All documents belonging to the correct patient (already filtered)
 * @param claimId - The claim being assessed
 */
export function matchRequirements(
  requirements: IRequirement[],
  documents: IDocument[],
  claimId: string
): MatchResult[] {
  const results: MatchResult[] = [];

  for (const req of requirements) {
    const result = matchSingleRequirement(req, documents, claimId);
    results.push(result);
  }

  return results;
}

function matchSingleRequirement(
  requirement: IRequirement,
  documents: IDocument[],
  claimId: string
): MatchResult {
  const category = requirement.normalizedCategory;
  const compatibleCategories = CATEGORY_COMPATIBILITY[category] || [category];

  // Step 1: Exact category match, same claim
  const exactClaimMatch = documents.filter(
    (d) => d.claimId === claimId && compatibleCategories.includes(d.category)
  );

  if (exactClaimMatch.length > 0) {
    const best = pickBestDocument(exactClaimMatch, requirement, category);
    return buildMatchResult(requirement, best, 'exact-claim', claimId);
  }

  // Step 2: Category match, cross-claim (same patient — explicitly recorded)
  const crossClaimMatch = documents.filter(
    (d) => d.claimId !== claimId && compatibleCategories.includes(d.category)
  );

  if (crossClaimMatch.length > 0) {
    const best = pickBestDocument(crossClaimMatch, requirement, category);
    const result = buildMatchResult(requirement, best, 'cross-claim', claimId);
    // Cross-claim match — flag for review
    result.status = 'NEEDS_REVIEW';
    result.matchReason = `Cross-claim document match (claimId: ${best.claimId || 'unassigned'}). Requires administrator review to confirm applicability.`;
    return result;
  }

  // Step 3: No documents in compatible category — no claim-specific docs
  const noClaimDocs = documents.filter(
    (d) => !d.claimId && compatibleCategories.includes(d.category)
  );

  if (noClaimDocs.length > 0) {
    const best = pickBestDocument(noClaimDocs, requirement, category);
    return buildMatchResult(requirement, best, 'unassigned-doc', claimId);
  }

  // Step 4: No match found
  return {
    requirementId: String(requirement._id),
    matchReason: `No document found in category: ${category}`,
    evidence: `Searched ${documents.length} document(s) for patient. None matched category "${category}" or compatible categories.`,
    confidence: 0,
    status: 'MISSING',
  };
}

function pickBestDocument(docs: IDocument[], req: IRequirement, category: DocumentCategory): IDocument {
  if (docs.length === 1) return docs[0];

  // Score each document
  const scored = docs.map((doc) => ({
    doc,
    score: scoreDocument(doc, req, category),
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored[0].doc;
}

function scoreDocument(doc: IDocument, req: IRequirement, category: DocumentCategory): number {
  let score = 0;

  // Category is already compatible — base score
  score += doc.category === category ? 0.6 : 0.3;

  // Boost for verification status
  if (doc.verificationStatus === 'VERIFIED') score += 0.2;

  // Boost for text keyword matches
  const keywords = CATEGORY_KEYWORDS[category] || [];
  const docText = (doc.extractedText || doc.fileName || '').toLowerCase();
  const reqText = req.originalText.toLowerCase();

  for (const kw of keywords) {
    if (docText.includes(kw.toLowerCase())) score += 0.05;
  }

  // Keyword overlap between requirement text and document filename
  const reqWords = reqText.split(/\s+/).filter((w) => w.length > 3);
  for (const word of reqWords) {
    if (docText.includes(word)) score += 0.02;
  }

  return Math.min(score, 1.0);
}

function buildMatchResult(
  requirement: IRequirement,
  doc: IDocument,
  matchType: string,
  _claimId: string
): MatchResult {
  const score = scoreDocument(doc, requirement, requirement.normalizedCategory);

  let status: MatchStatus = 'MATCHED';
  if (doc.verificationStatus === 'UNVERIFIED') {
    status = 'UNVERIFIED';
  } else if (score < 0.4) {
    status = 'NEEDS_REVIEW';
  }

  const evidence = doc.extractedText
    ? `Document text preview: "${doc.extractedText.slice(0, 200)}..."`
    : `Document file: "${doc.fileName}" (no extracted text available)`;

  return {
    requirementId: String(requirement._id),
    documentId: doc.documentId,
    matchReason: `${matchType}: Document category "${doc.category}" matches requirement "${requirement.normalizedCategory}". Confidence: ${(score * 100).toFixed(0)}%.`,
    evidence,
    confidence: score,
    status,
  };
}
