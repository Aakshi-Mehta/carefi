import QueryModel from '../models/Query';
import Requirement from '../models/Requirement';
import Match from '../models/Match';
import DocumentModel from '../models/Document';
import Patient from '../models/Patient';
import { writeAudit } from '../lib/audit';
import { extractRequirements } from '../services/requirementExtractor';
import { matchRequirements } from '../services/documentMatcher';
import { automateQueryResponse } from '../services/queryAutomation';

jest.mock('../models/Query', () => ({ __esModule: true, default: { findOne: jest.fn(), findOneAndUpdate: jest.fn() } }));
jest.mock('../models/Requirement', () => ({ __esModule: true, default: { insertMany: jest.fn(), findByIdAndUpdate: jest.fn() } }));
jest.mock('../models/Match', () => ({ __esModule: true, default: { findOneAndUpdate: jest.fn() } }));
jest.mock('../models/Document', () => ({ __esModule: true, default: { find: jest.fn() } }));
jest.mock('../models/Patient', () => ({ __esModule: true, default: { findOne: jest.fn() } }));
jest.mock('../lib/audit', () => ({ writeAudit: jest.fn() }));
jest.mock('../services/requirementExtractor', () => ({ extractRequirements: jest.fn() }));
jest.mock('../services/documentMatcher', () => ({ matchRequirements: jest.fn() }));

const queryModelMock = QueryModel as unknown as { findOne: jest.Mock; findOneAndUpdate: jest.Mock };
const requirementModelMock = Requirement as unknown as { insertMany: jest.Mock; findByIdAndUpdate: jest.Mock };
const matchModelMock = Match as unknown as { findOneAndUpdate: jest.Mock };
const documentModelMock = DocumentModel as unknown as { find: jest.Mock };
const patientModelMock = Patient as unknown as { findOne: jest.Mock };

describe('Automatic query response', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queryModelMock.findOne.mockResolvedValue({
      queryId: 'QRY-1',
      patientId: 'PAT-1',
      claimId: 'CLM-1',
      originalText: 'Please provide the treating doctor prescription.',
    });
    queryModelMock.findOneAndUpdate.mockResolvedValue(null);
    requirementModelMock.insertMany.mockResolvedValue([{
      _id: 'REQ-MONGO-1',
      reviewStatus: 'APPROVED',
    }]);
    requirementModelMock.findByIdAndUpdate.mockResolvedValue(null);
    matchModelMock.findOneAndUpdate.mockResolvedValue(null);
    documentModelMock.find.mockResolvedValue([]);
    patientModelMock.findOne.mockResolvedValue({
      patientId: 'PAT-1',
      name: 'Demo Patient',
      phone: '+910000000000',
      email: 'demo@example.invalid',
    });
    (writeAudit as jest.Mock).mockResolvedValue(undefined);
    (extractRequirements as jest.Mock).mockReturnValue([{
      requirementId: 'REQ-1',
      originalText: 'Treating doctor prescription',
      normalizedCategory: 'PRESCRIPTION',
      evidence: 'Please provide the treating doctor prescription.',
      confidence: 0.9,
      isUncertain: false,
    }]);
    (matchRequirements as jest.Mock).mockReturnValue([{
      requirementId: 'REQ-MONGO-1',
      status: 'MISSING',
      matchReason: 'No matching document found',
      evidence: 'No prescription is stored for this claim.',
      confidence: 0,
    }]);
  });

  test('identifies missing requirements without sending a message before staff review', async () => {
    const result = await automateQueryResponse('QRY-1', 'USR-1');

    expect(result.status).toBe('COMPLETED');
    expect(result.missingCount).toBe(1);
    expect(result.channels).toEqual([]);
    expect(result.detail).toContain('Prepare and review a patient message before sending');
  });

  test('does not contact the patient when extraction is uncertain', async () => {
    (extractRequirements as jest.Mock).mockReturnValue([{
      requirementId: 'REQ-1',
      originalText: 'Additional supporting documentation',
      normalizedCategory: 'OTHER',
      evidence: 'Please provide additional supporting documentation.',
      confidence: 0.2,
      isUncertain: true,
    }]);

    const result = await automateQueryResponse('QRY-1', 'USR-1');

    expect(result.status).toBe('NEEDS_REVIEW');
    expect(result.channels).toEqual([]);
  });
});