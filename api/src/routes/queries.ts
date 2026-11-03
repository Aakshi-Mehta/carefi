import { Router, Response } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import QueryModel from '../models/Query';
import Requirement from '../models/Requirement';
import Match from '../models/Match';
import DocumentModel from '../models/Document';
import Patient from '../models/Patient';
import Claim from '../models/Claim';
import { requireAuth, requireStaff, AuthRequest } from '../middleware/authMiddleware';
import { writeAudit } from '../lib/audit';
import { extractPdfText } from '../services/pdfExtractor';
import { extractRequirements } from '../services/requirementExtractor';
import { matchRequirements } from '../services/documentMatcher';
import { automateQueryResponse } from '../services/queryAutomation';
import { openPatientFile, storePatientFile } from '../services/patientFileStorage';

const router = Router();

const queryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Only PDF files are accepted for query letters.'));
  },
});

/** POST /api/queries — upload query PDF */
router.post('/', requireStaff, queryUpload.single('queryFile'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No PDF file uploaded' });
      return;
    }

    const { patientId, claimId } = req.body as { patientId?: string; claimId?: string };
    if (!patientId || !claimId) {
      res.status(400).json({ error: 'patientId and claimId are required' });
      return;
    }

    // Verify patient and claim exist
    const [patient, claim] = await Promise.all([
      Patient.findOne({ patientId }),
      Claim.findOne({ claimId }),
    ]);
    if (!patient) { res.status(404).json({ error: `Patient ${patientId} not found` }); return; }
    if (!claim) { res.status(404).json({ error: `Claim ${claimId} not found` }); return; }
    if (claim.patientId !== patientId) {
      res.status(400).json({ error: 'Claim does not belong to the specified patient' });
      return;
    }

    // Extract text from PDF
    const extraction = await extractPdfText(req.file.buffer);

    if (!extraction.text || extraction.text.length < 20) {
      res.status(422).json({
        error: 'Could not extract sufficient text from this PDF',
        partial: extraction.partial,
        ocrUsed: extraction.ocrUsed,
        details: extraction.error || 'Text is too short or empty. Please check the file and try again, or upload a text-based PDF.',
      });
      return;
    }

    const queryId = `QRY-${uuidv4().slice(0, 8).toUpperCase()}`;
    const storageFileId = await storePatientFile({
      buffer: req.file.buffer,
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
      metadata: { patientId, claimId, queryId, kind: 'INSURER_QUERY' },
    });
    const query = await QueryModel.create({
      queryId,
      patientId,
      claimId,
      originalFileName: req.file.originalname,
      originalText: extraction.text,
      storageFileId,
      pageCount: extraction.pageCount,
      ocrUsed: extraction.ocrUsed,
      extractionStatus: 'PENDING',
      matchingStatus: 'PENDING',
      uploadedBy: req.user!.userId,
    });

    await DocumentModel.create({
      documentId: `DOC-${uuidv4().slice(0, 8).toUpperCase()}`,
      patientId,
      claimId,
      fileName: req.file.originalname,
      category: 'INSURER_QUERY',
      mimeType: req.file.mimetype,
      source: 'UPLOAD',
      storageFileId,
      extractedText: extraction.text,
      verificationStatus: 'VERIFIED',
      fileSize: req.file.size,
      uploadedBy: req.user!.userId,
      notes: `Original insurer query letter ${queryId}`,
    });

    await writeAudit({
      actor: req.user!.userId,
      action: 'QUERY_UPLOADED',
      resourceType: 'Query',
      resourceId: queryId,
      metadata: { patientId, claimId, fileName: req.file.originalname, ocrUsed: extraction.ocrUsed },
    });

    // Update claim status
    await Claim.findOneAndUpdate({ claimId }, { status: 'QUERY_RECEIVED' });

    const automation = await automateQueryResponse(queryId, req.user!.userId);
    const processedQuery = await QueryModel.findOne({ queryId }).lean();
    res.status(201).json({
      query: processedQuery || query,
      textPreview: extraction.text.slice(0, 300),
      automation,
    });
  } catch (err) {
    console.error('[Queries] Upload error:', err);
    res.status(500).json({ error: 'Failed to upload query' });
  }
});

/** GET /api/queries/:id/file — authenticated download of the original query letter */
router.get('/:id/file', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const query = await QueryModel.findOne({ queryId: req.params.id }).lean();
    if (!query?.storageFileId) {
      res.status(404).json({ error: 'Stored query letter not found' });
      return;
    }

    const safeFileName = query.originalFileName.replace(/[\r\n"]/g, '_');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFileName}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    const download = openPatientFile(query.storageFileId);
    download.on('error', (error) => {
      console.error('[Queries] File download failed:', error.message);
      if (!res.headersSent) res.status(404).json({ error: 'Stored query letter not found' });
      else res.destroy(error);
    });
    download.pipe(res);
  } catch (error) {
    console.error('[Queries] File download error:', (error as Error).message);
    if (!res.headersSent) res.status(500).json({ error: 'Failed to download query letter' });
  }
});

/** GET /api/queries */
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { patientId, claimId, status, page = '1', limit = '20' } = req.query as Record<string, string>;
    const query: Record<string, unknown> = {};
    if (patientId) query.patientId = patientId;
    if (claimId) query.claimId = claimId;
    if (status) query.extractionStatus = status;

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, parseInt(limit, 10));

    const [queries, total] = await Promise.all([
      QueryModel.find(query).sort('-createdAt').skip((pageNum - 1) * limitNum).limit(limitNum).lean(),
      QueryModel.countDocuments(query),
    ]);

    res.json({ data: queries, pagination: { page: pageNum, limit: limitNum, total } });
  } catch {
    res.status(500).json({ error: 'Failed to fetch queries' });
  }
});

/** GET /api/queries/:id */
router.get('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const [query, requirements] = await Promise.all([
      QueryModel.findOne({ queryId: req.params.id }).lean(),
      Requirement.find({ queryId: req.params.id }).lean(),
    ]);
    if (!query) { res.status(404).json({ error: 'Query not found' }); return; }
    const matches = await Match.find({ requirementId: { $in: requirements.map((item) => String(item._id)) } }).lean();
    res.json({ query, requirements, matches });
  } catch {
    res.status(500).json({ error: 'Failed to fetch query' });
  }
});

/** POST /api/queries/:id/extract — run requirement extraction */
router.post('/:id/extract', requireStaff, async (req: AuthRequest, res: Response) => {
  try {
    const query = await QueryModel.findOne({ queryId: req.params.id });
    if (!query) { res.status(404).json({ error: 'Query not found' }); return; }

    if (query.extractionStatus === 'COMPLETED') {
      const existing = await Requirement.find({ queryId: query.queryId }).lean();
      res.json({ message: 'Already extracted', requirements: existing });
      return;
    }

    await QueryModel.findOneAndUpdate({ queryId: req.params.id }, { extractionStatus: 'PROCESSING' });

    try {
      const extracted = extractRequirements(query.originalText);

      if (extracted.length === 0) {
        await QueryModel.findOneAndUpdate(
          { queryId: req.params.id },
          { extractionStatus: 'NEEDS_REVIEW' }
        );
        res.json({ message: 'No requirements could be extracted. Manual review required.', requirements: [] });
        return;
      }

      // Save each requirement with the queryId
      const saved = await Promise.all(
        extracted.map((r) =>
          Requirement.create({
            requirementId: r.requirementId,
            queryId: query.queryId,
            originalText: r.originalText,
            normalizedCategory: r.normalizedCategory,
            evidence: r.evidence,
            sourcePage: r.sourcePage,
            confidence: r.confidence,
            status: r.isUncertain ? 'UNCERTAIN' : 'PENDING',
            reviewStatus: r.isUncertain ? 'PENDING' : 'APPROVED',
          })
        )
      );

      await QueryModel.findOneAndUpdate(
        { queryId: req.params.id },
        { extractionStatus: 'COMPLETED' }
      );

      await writeAudit({
        actor: req.user!.userId,
        action: 'REQUIREMENTS_EXTRACTED',
        resourceType: 'Query',
        resourceId: req.params.id,
        metadata: { count: saved.length, uncertainCount: saved.filter((r) => r.status === 'UNCERTAIN').length },
      });

      res.json({ message: `Extracted ${saved.length} requirement(s)`, requirements: saved });
    } catch (extractErr) {
      await QueryModel.findOneAndUpdate({ queryId: req.params.id }, { extractionStatus: 'FAILED' });
      throw extractErr;
    }
  } catch (err) {
    console.error('[Queries] Extract error:', err);
    res.status(500).json({ error: 'Requirement extraction failed' });
  }
});

/** POST /api/queries/:id/match — run document matching */
router.post('/:id/match', requireStaff, async (req: AuthRequest, res: Response) => {
  try {
    const query = await QueryModel.findOne({ queryId: req.params.id });
    if (!query) { res.status(404).json({ error: 'Query not found' }); return; }

    if (query.extractionStatus !== 'COMPLETED') {
      res.status(422).json({ error: 'Requirements must be extracted before matching' });
      return;
    }

    await QueryModel.findOneAndUpdate({ queryId: req.params.id }, { matchingStatus: 'PROCESSING' });

    const [requirements, documents] = await Promise.all([
      Requirement.find({ queryId: query.queryId }),
      // CRITICAL: Only match documents belonging to the same patient
      DocumentModel.find({ patientId: query.patientId }),
    ]);

    const matchResults = matchRequirements(requirements, documents, query.claimId);

    // Save match records and update requirement statuses
    await Promise.all(
      matchResults.map(async (result) => {
        // Upsert match record
        await Match.findOneAndUpdate(
          { requirementId: result.requirementId },
          {
            requirementId: result.requirementId,
            documentId: result.documentId,
            matchReason: result.matchReason,
            evidence: result.evidence,
            confidence: result.confidence,
            status: result.status,
          },
          { upsert: true, new: true }
        );

        // Update requirement status
        await Requirement.findByIdAndUpdate(result.requirementId, {
          status: result.status === 'MATCHED' ? 'MATCHED' :
                  result.status === 'MISSING' ? 'MISSING' :
                  result.status === 'NEEDS_REVIEW' ? 'NEEDS_REVIEW' :
                  result.status === 'UNVERIFIED' ? 'NEEDS_REVIEW' : 'NEEDS_REVIEW',
        });
      })
    );

    const missingCount = matchResults.filter((r) => r.status === 'MISSING').length;
    const matchedCount = matchResults.filter((r) => r.status === 'MATCHED').length;

    await QueryModel.findOneAndUpdate(
      { queryId: req.params.id },
      { matchingStatus: 'COMPLETED' }
    );

    // Update claim status if there are missing documents
    if (missingCount > 0) {
      await Claim.findOneAndUpdate({ claimId: query.claimId }, { status: 'DOCUMENTS_PENDING' });
    }

    await writeAudit({
      actor: req.user!.userId,
      action: 'DOCUMENT_MATCHED',
      resourceType: 'Query',
      resourceId: req.params.id,
      metadata: { matchedCount, missingCount },
    });

    res.json({ message: 'Matching complete', matchResults, summary: { matched: matchedCount, missing: missingCount, total: matchResults.length } });
  } catch (err) {
    await QueryModel.findOneAndUpdate({ queryId: req.params.id }, { matchingStatus: 'FAILED' });
    console.error('[Queries] Match error:', err);
    res.status(500).json({ error: 'Document matching failed' });
  }
});

/** POST /api/queries/:id/approve — admin approves all extracted requirements */
router.post('/:id/approve', requireStaff, async (req: AuthRequest, res: Response) => {
  try {
    const result = await Requirement.updateMany(
      { queryId: req.params.id, reviewStatus: 'PENDING' },
      { $set: { reviewStatus: 'APPROVED', reviewedBy: req.user!.userId, reviewedAt: new Date() } }
    );

    await writeAudit({
      actor: req.user!.userId,
      action: 'REQUIREMENTS_APPROVED',
      resourceType: 'Query',
      resourceId: req.params.id,
      metadata: { approvedCount: result.modifiedCount },
    });

    res.json({ message: `${result.modifiedCount} requirement(s) approved` });
  } catch {
    res.status(500).json({ error: 'Failed to approve requirements' });
  }
});

export default router;
