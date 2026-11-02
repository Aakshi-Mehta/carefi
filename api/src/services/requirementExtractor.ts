/**
 * Deterministic Requirement Extraction Pipeline
 *
 * Extracts individual document requirements from insurer query letter text.
 * Uses no paid AI APIs. All logic is deterministic — keyword/phrase matching,
 * sentence segmentation, and evidence preservation.
 *
 * Design principles:
 * - Every requirement must be supported by actual text from the query letter.
 * - If extraction is uncertain, the requirement is marked UNCERTAIN and flagged
 *   for human review. It is never silently guessed.
 * - Requirements are never invented. Only text present in the source is used.
 */

import { v4 as uuidv4 } from 'uuid';
import type { DocumentCategory } from '../models/Document';

export interface ExtractedRequirement {
  requirementId: string;
  originalText: string;
  normalizedCategory: DocumentCategory;
  evidence: string;
  sourcePage?: number;
  confidence: number;
  isUncertain: boolean;
}

// ---------------------------------------------------------------------------
// Category keyword map
// Each category has required and optional keyword groups.
// A match requires at least one keyword from the REQUIRED list.
// ---------------------------------------------------------------------------

interface CategoryRule {
  category: DocumentCategory;
  requiredKeywords: string[];
  boostKeywords: string[];
  weight: number;
}

const CATEGORY_RULES: CategoryRule[] = [
  {
    category: 'DISCHARGE_SUMMARY',
    requiredKeywords: ['discharge', 'discharge summary', 'discharged'],
    boostKeywords: ['hospital discharge', 'final discharge', 'discharge note'],
    weight: 1.0,
  },
  {
    category: 'PRESCRIPTION',
    requiredKeywords: [
      'prescription', 'treating doctor', "doctor's prescription", 'physician prescription',
      'medical prescription', 'doctor prescription', 'rx', 'prescribed medication',
    ],
    boostKeywords: ['treating physician', 'consulting doctor', 'prescribing doctor'],
    weight: 1.0,
  },
  {
    category: 'INVESTIGATION_REPORT',
    requiredKeywords: [
      'investigation report', 'investigation', 'diagnostic investigation',
      'test reports', 'test report', 'investigation reports',
    ],
    boostKeywords: ['pathology', 'radiology', 'imaging report', 'scan report'],
    weight: 1.0,
  },
  {
    category: 'HOSPITAL_BILL',
    requiredKeywords: [
      'hospital bill', 'final bill', 'detailed bill', 'hospital invoice',
      'billing statement', 'itemized bill', 'medical bill', 'inpatient bill',
    ],
    boostKeywords: ['receipt', 'account statement', 'payment receipt'],
    weight: 1.0,
  },
  {
    category: 'LAB_REPORT',
    requiredKeywords: [
      'lab report', 'laboratory report', 'blood test', 'urine test',
      'pathology report', 'haematology', 'biochemistry', 'lab results',
      'laboratory results', 'test results',
    ],
    boostKeywords: ['CBC', 'LFT', 'RFT', 'lipid profile'],
    weight: 1.0,
  },
  {
    category: 'DIAGNOSTIC_REPORT',
    requiredKeywords: [
      'diagnostic report', 'mri', 'ct scan', 'x-ray', 'xray', 'ultrasound',
      'ecg', 'eeg', 'echo', 'echocardiogram', 'imaging', 'radiological',
      'endoscopy', 'biopsy report',
    ],
    boostKeywords: ['scan', 'radiology report', 'doppler', 'angiography'],
    weight: 1.0,
  },
  {
    category: 'ADMISSION_RECORD',
    requiredKeywords: [
      'admission record', 'admission note', 'admission summary',
      'indoor case papers', 'case papers', 'inpatient record',
      'hospitalization record', 'indoor file',
    ],
    boostKeywords: ['admission form', 'case sheet'],
    weight: 1.0,
  },
  {
    category: 'HEALTH_INSURANCE_CARD',
    requiredKeywords: [
      'insurance card', 'health card', 'membership card',
      'policy card', 'tpa card', 'e-card',
    ],
    boostKeywords: ['mediclaim card', 'insurance id'],
    weight: 0.9,
  },
  {
    category: 'POLICY_DOCUMENT',
    requiredKeywords: [
      'policy document', 'policy copy', 'insurance policy',
      'policy certificate', 'policy schedule',
    ],
    boostKeywords: ['terms and conditions', 'endorsement'],
    weight: 0.9,
  },
  {
    category: 'GOVERNMENT_ID',
    requiredKeywords: [
      'government id', 'identity proof', 'id proof', 'aadhar',
      'aadhaar', 'pan card', 'passport', 'voter id', 'driving licence',
    ],
    boostKeywords: ['photo id', 'kyc document'],
    weight: 0.9,
  },
  {
    category: 'PHARMACY_BILL',
    requiredKeywords: [
      'pharmacy bill', 'medicine bill', 'drug bill',
      'pharmacy invoice', 'chemist bill', 'pharmacy receipt',
    ],
    boostKeywords: ['medicines', 'drugs'],
    weight: 1.0,
  },
];

// ---------------------------------------------------------------------------
// Segment patterns — detect list structures in query letters
// ---------------------------------------------------------------------------

const LIST_ITEM_PATTERNS = [
  /^[\-\•\*\–\—]\s+(.+)/,        // Bullet points
  /^\d+[\.\)]\s+(.+)/,             // Numbered lists: 1. or 1)
  /^[a-zA-Z][\.\)]\s+(.+)/,       // Lettered: a. or a)
  /^[ivxlIVXL]+[\.\)]\s+(.+)/,    // Roman numerals: i. ii.
];

const REQUIREMENT_TRIGGER_PHRASES = [
  'please submit',
  'please provide',
  'please send',
  'kindly submit',
  'kindly provide',
  'kindly send',
  'the following documents',
  'following documents are required',
  'documents required',
  'documents needed',
  'we require',
  'we request',
  'you are requested',
  'please furnish',
  'to process',
  'to proceed',
  'for assessment',
  'for processing',
  'for claim processing',
];

// ---------------------------------------------------------------------------
// Core extraction function
// ---------------------------------------------------------------------------

export function extractRequirements(text: string): ExtractedRequirement[] {
  if (!text || text.trim().length === 0) return [];

  const normalizedText = normalizeWhitespace(text);
  const lines = normalizedText.split('\n');

  const requirements: ExtractedRequirement[] = [];

  // Strategy 1: Extract from list items in context of requirement sections
  const listItems = extractListItems(lines, normalizedText);

  // Strategy 2: Extract from paragraph sentences that mention documents
  const sentenceItems = extractFromSentences(normalizedText);

  // Merge and deduplicate
  const allCandidates = [...listItems, ...sentenceItems];
  const deduplicated = deduplicateCandidates(allCandidates);

  // Classify each candidate
  for (const candidate of deduplicated) {
    const classification = classifyRequirement(candidate);
    if (classification) {
      requirements.push({
        requirementId: `REQ-${uuidv4().slice(0, 8).toUpperCase()}`,
        originalText: candidate,
        normalizedCategory: classification.category,
        evidence: candidate,
        confidence: classification.confidence,
        isUncertain: classification.confidence < 0.5,
      });
    }
  }

  // If no structured list was found, try to extract all mentioned document types
  if (requirements.length === 0) {
    const fallback = fallbackExtraction(normalizedText);
    requirements.push(...fallback);
  }

  return requirements;
}

// ---------------------------------------------------------------------------
// List item extractor
// ---------------------------------------------------------------------------

function extractListItems(lines: string[], fullText: string): string[] {
  const items: string[] = [];
  let inRequirementSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Detect if we've entered a requirement section
    const lineLower = line.toLowerCase();
    if (REQUIREMENT_TRIGGER_PHRASES.some((p) => lineLower.includes(p))) {
      inRequirementSection = true;
      continue;
    }

    // Check if line is a list item
    for (const pattern of LIST_ITEM_PATTERNS) {
      const match = line.match(pattern);
      if (match) {
        const itemText = match[1].trim();
        if (itemText.length > 5) {
          items.push(itemText);
          if (!inRequirementSection) {
            // Accept list items even outside explicit requirement sections
            // but mark for lower confidence
          }
        }
        break;
      }
    }
  }

  // If no items with context, scan whole text for list items
  if (items.length === 0) {
    for (const line of lines) {
      const trimmed = line.trim();
      for (const pattern of LIST_ITEM_PATTERNS) {
        const match = trimmed.match(pattern);
        if (match && match[1].trim().length > 5) {
          items.push(match[1].trim());
          break;
        }
      }
    }
  }

  return items;
}

// ---------------------------------------------------------------------------
// Sentence-level extractor
// ---------------------------------------------------------------------------

function extractFromSentences(text: string): string[] {
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 15);

  const documentMentions: string[] = [];

  for (const sentence of sentences) {
    const lower = sentence.toLowerCase();
    // Check if sentence mentions a known document type
    for (const rule of CATEGORY_RULES) {
      if (rule.requiredKeywords.some((kw) => lower.includes(kw.toLowerCase()))) {
        documentMentions.push(sentence);
        break;
      }
    }
  }

  return documentMentions;
}

// ---------------------------------------------------------------------------
// Fallback: scan full text for any document category mentions
// ---------------------------------------------------------------------------

function fallbackExtraction(text: string): ExtractedRequirement[] {
  const results: ExtractedRequirement[] = [];
  const lower = text.toLowerCase();
  const seen = new Set<string>();

  for (const rule of CATEGORY_RULES) {
    for (const kw of rule.requiredKeywords) {
      if (lower.includes(kw.toLowerCase()) && !seen.has(rule.category)) {
        seen.add(rule.category);
        // Find the sentence containing this keyword
        const idx = lower.indexOf(kw.toLowerCase());
        const snippet = extractSnippet(text, idx, 150);
        results.push({
          requirementId: `REQ-${uuidv4().slice(0, 8).toUpperCase()}`,
          originalText: kw,
          normalizedCategory: rule.category,
          evidence: snippet,
          confidence: 0.45, // Low confidence — fallback extraction
          isUncertain: true,
        });
        break;
      }
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

interface ClassificationResult {
  category: DocumentCategory;
  confidence: number;
}

function classifyRequirement(text: string): ClassificationResult | null {
  const lower = text.toLowerCase();
  let bestMatch: ClassificationResult | null = null;
  let bestScore = 0;

  for (const rule of CATEGORY_RULES) {
    let score = 0;
    let hasRequired = false;

    for (const kw of rule.requiredKeywords) {
      if (lower.includes(kw.toLowerCase())) {
        score += 0.6;
        hasRequired = true;
        break;
      }
    }

    if (!hasRequired) continue;

    for (const kw of rule.boostKeywords) {
      if (lower.includes(kw.toLowerCase())) {
        score += 0.2;
        break;
      }
    }

    const totalScore = score * rule.weight;
    if (totalScore > bestScore) {
      bestScore = totalScore;
      bestMatch = {
        category: rule.category,
        confidence: Math.min(totalScore, 1.0),
      };
    }
  }

  // If no category matched, classify as OTHER with low confidence
  if (!bestMatch && text.length > 5) {
    return {
      category: 'OTHER',
      confidence: 0.3,
    };
  }

  return bestMatch;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeWhitespace(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function deduplicateCandidates(candidates: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const candidate of candidates) {
    const normalized = candidate.toLowerCase().replace(/\s+/g, ' ').trim();
    if (!seen.has(normalized) && normalized.length > 5) {
      seen.add(normalized);
      result.push(candidate);
    }
  }

  return result;
}

function extractSnippet(text: string, centerIndex: number, radius: number): string {
  const start = Math.max(0, centerIndex - radius);
  const end = Math.min(text.length, centerIndex + radius);
  return text.slice(start, end).trim();
}
