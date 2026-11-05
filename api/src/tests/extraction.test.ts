import axios from 'axios';
import { _resetConfig } from '../lib/env';
import { extractRequirements, RequirementExtractionError } from '../services/requirementExtractor';

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    post: jest.fn(),
    isAxiosError: jest.fn(() => false),
  },
}));

const sourceText = `Please provide the following:
1. Treating doctor's prescription
2. Investigation reports`;
const originalGroqApiKey = process.env.GROQ_API_KEY;
const originalGroqModel = process.env.GROQ_MODEL;

function mockGroqRequirements(requirements: unknown[]) {
  (axios.post as jest.Mock).mockResolvedValue({
    data: {
      choices: [{ message: { content: JSON.stringify({ requirements }) } }],
    },
  });
}

describe('Groq requirement extraction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GROQ_API_KEY = 'test-groq-key';
    _resetConfig();
  });

  afterAll(() => {
    if (originalGroqApiKey === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = originalGroqApiKey;
    if (originalGroqModel === undefined) delete process.env.GROQ_MODEL;
    else process.env.GROQ_MODEL = originalGroqModel;
    _resetConfig();
  });

  test('extracts multiple explicitly requested documents with source evidence', async () => {
    mockGroqRequirements([
      {
        originalText: "Treating doctor's prescription",
        normalizedCategory: 'PRESCRIPTION',
        evidence: "1. Treating doctor's prescription",
        confidence: 0.96,
      },
      {
        originalText: 'Investigation reports',
        normalizedCategory: 'INVESTIGATION_REPORT',
        evidence: '2. Investigation reports',
        confidence: 0.92,
      },
    ]);

    const results = await extractRequirements(sourceText);

    expect(results).toHaveLength(2);
    expect(results.map((result) => result.normalizedCategory)).toEqual([
      'PRESCRIPTION',
      'INVESTIGATION_REPORT',
    ]);
    expect(results.every((result) => !result.isUncertain)).toBe(true);
    expect(results[0].requirementId).toMatch(/^REQ-[A-F0-9]{8}$/);
    expect(axios.post).toHaveBeenCalledWith(
      'https://api.groq.com/openai/v1/chat/completions',
      expect.objectContaining({
        model: expect.any(String),
        response_format: { type: 'json_object' },
      }),
      expect.objectContaining({
        headers: { Authorization: 'Bearer test-groq-key' },
        timeout: 30_000,
      })
    );
  });

  test('returns no requirements for empty text without calling the LLM', async () => {
    await expect(extractRequirements('  ')).resolves.toEqual([]);
    expect(axios.post).not.toHaveBeenCalled();
  });

  test('marks low-confidence and unknown categories for human review', async () => {
    mockGroqRequirements([
      {
        originalText: 'Treating doctor',
        normalizedCategory: 'UNSUPPORTED_CATEGORY',
        evidence: "1. Treating doctor's prescription",
        confidence: 0.4,
      },
    ]);

    const [result] = await extractRequirements(sourceText);
    expect(result.normalizedCategory).toBe('OTHER');
    expect(result.isUncertain).toBe(true);
  });

  test('rejects requirements or evidence that are not in the source letter', async () => {
    mockGroqRequirements([
      {
        originalText: 'An invented hospital bill',
        normalizedCategory: 'HOSPITAL_BILL',
        evidence: 'The insurer requests a hospital bill.',
        confidence: 0.99,
      },
    ]);

    await expect(extractRequirements(sourceText)).rejects.toThrow(
      'without matching source evidence'
    );
  });

  test('rejects invalid model output instead of silently falling back', async () => {
    (axios.post as jest.Mock).mockResolvedValue({
      data: { choices: [{ message: { content: 'not json' } }] },
    });

    await expect(extractRequirements(sourceText)).rejects.toThrow(
      'invalid JSON'
    );
  });

  test('does not send oversized query text to Groq', async () => {
    await expect(extractRequirements('x'.repeat(30_001))).rejects.toThrow(
      'too long for AI extraction'
    );
    expect(axios.post).not.toHaveBeenCalled();
  });

  test('reports provider failures without falling back to heuristic extraction', async () => {
    (axios.post as jest.Mock).mockRejectedValue(new Error('provider unavailable'));

    await expect(extractRequirements(sourceText)).rejects.toThrow(
      'Could not reach Groq'
    );
  });

  test('reports missing Groq configuration explicitly', async () => {
    delete process.env.GROQ_API_KEY;
    _resetConfig();

    await expect(extractRequirements(sourceText)).rejects.toBeInstanceOf(
      RequirementExtractionError
    );
    expect(axios.post).not.toHaveBeenCalled();
  });
});
