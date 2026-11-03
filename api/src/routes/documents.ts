import { Router, Response } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import DocumentModel from '../models/Document';
import Patient from '../models/Patient';
import { requireAuth, requireStaff, AuthRequest } from '../middleware/authMiddleware';
import { writeAudit } from '../lib/audit';
import { extractPdfText } from '../services/pdfExtractor';
import { openPatientFile, storePatientFile } from '../services/patientFileStorage';
import type { DocumentCategory } from '../models/Document';

const router = Router();

// Multer: in-memory storage, 20 MB limit, PDF/image only
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/tiff'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed: ${file.mimetype}. Allowed: PDF, JPEG, PNG, TIFF.`));
    }
  },
});

const VALID_CATEGORIES: DocumentCategory[] = [
  'GOVERNMENT_ID', 'HEALTH_INSURANCE_CARD', 'POLICY_DOCUMENT',
  'ADMISSION_RECORD', 'DISCHARGE_SUMMARY', 'PRESCRIPTION',
  'DIAGNOSTIC_REPORT', 'LAB_REPORT', 'HOSPITAL_BILL',
  'PHARMACY_BILL', 'INVESTIGATION_REPORT', 'INSURER_QUERY', 'OTHER',
];

/** GET /api/documents */
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { patientId, claimId, category, page = '1', limit = '20' } = req.query as Record<string, string>;
    const query: Record<string, unknown> = {};
    if (patientId) query.patientId = patientId;
    if (claimId) query.claimId = claimId;
    if (category) query.category = category;

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));

    const [docs, total] = await Promise.all([
      DocumentModel.find(query).sort('-createdAt').skip((pageNum - 1) * limitNum).limit(limitNum).lean(),
      DocumentModel.countDocuments(query),
    ]);

    res.json({ data: docs, pagination: { page: pageNum, limit: limitNum, total } });
  } catch {
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

/** POST /api/documents — upload with text extraction */
router.post('/', requireStaff, upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const { patientId, claimId, category, notes } = req.body as {
      patientId?: string;
      claimId?: string;
      category?: string;
      notes?: string;
    };

    if (!patientId || !category) {
      res.status(400).json({ error: 'patientId and category are required' });
      return;
    }

    if (!VALID_CATEGORIES.includes(category as DocumentCategory)) {
      res.status(400).json({ error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}` });
      return;
    }

    const patient = await Patient.findOne({ patientId });
    if (!patient) {
      res.status(404).json({ error: `Patient ${patientId} not found` });
      return;
    }

    // Extract text if PDF
    let extractedText: string | undefined;
    let ocrUsed = false;
    if (req.file.mimetype === 'application/pdf') {
      try {
        const result = await extractPdfText(req.file.buffer);
        extractedText = result.text || undefined;
        ocrUsed = result.ocrUsed;
        if (result.partial && result.error) {
          console.warn('[Documents] Partial extraction:', result.error);
        }
      } catch (extractErr) {
        console.warn('[Documents] Text extraction failed:', (extractErr as Error).message);
      }
    }

    const documentId = `DOC-${uuidv4().slice(0, 8).toUpperCase()}`;
    const storageFileId = await storePatientFile({
      buffer: req.file.buffer,
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
      metadata: { patientId, documentId, category },
    });
    const doc = await DocumentModel.create({
      documentId,
      patientId,
      claimId: claimId || undefined,
      fileName: req.file.originalname,
      category: category as DocumentCategory,
      mimeType: req.file.mimetype,
      source: 'UPLOAD',
      storageFileId,
      extractedText,
      verificationStatus: 'UNVERIFIED',
      fileSize: req.file.size,
      uploadedBy: req.user!.userId,
      notes,
    });

    await writeAudit({
      actor: req.user!.userId,
      action: 'DOCUMENT_UPLOADED',
      resourceType: 'Document',
      resourceId: documentId,
      metadata: {
        patientId, claimId, category,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        ocrUsed,
        textExtracted: !!extractedText,
      },
    });

    res.status(201).json(doc);
  } catch (err) {
    console.error('[Documents] Upload error:', err);
    if ((err as Error).message.includes('File type not allowed')) {
      res.status(400).json({ error: (err as Error).message });
      return;
    }
    res.status(500).json({ error: 'Failed to upload document' });
  }
});

/** GET /api/documents/:id/file — authenticated download of the original file */
router.get('/:id/file', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const doc = await DocumentModel.findOne({ documentId: req.params.id }).lean();
    if (!doc?.storageFileId) {
      res.status(404).json({ error: 'Stored document file not found' });
      return;
    }

    const safeFileName = doc.fileName.replace(/[\r\n"]/g, '_');
    res.setHeader('Content-Type', doc.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${safeFileName}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    const download = openPatientFile(doc.storageFileId);
    download.on('error', (error) => {
      console.error('[Documents] File download failed:', error.message);
      if (!res.headersSent) res.status(404).json({ error: 'Stored document file not found' });
      else res.destroy(error);
    });
    download.pipe(res);
  } catch (error) {
    console.error('[Documents] File download error:', (error as Error).message);
    if (!res.headersSent) res.status(500).json({ error: 'Failed to download document' });
  }
});

/** GET /api/documents/:id */
router.get('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const doc = await DocumentModel.findOne({ documentId: req.params.id }).lean();
    if (!doc) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }
    res.json(doc);
  } catch {
    res.status(500).json({ error: 'Failed to fetch document' });
  }
});

/** POST /api/documents/:id/verify */
router.post('/:id/verify', requireStaff, async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.body as { status?: string };
    if (!status || !['VERIFIED', 'REJECTED'].includes(status)) {
      res.status(400).json({ error: 'status must be VERIFIED or REJECTED' });
      return;
    }

    const doc = await DocumentModel.findOneAndUpdate(
      { documentId: req.params.id },
      { $set: { verificationStatus: status } },
      { new: true }
    );

    if (!doc) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    await writeAudit({
      actor: req.user!.userId,
      action: 'DOCUMENT_VERIFIED',
      resourceType: 'Document',
      resourceId: req.params.id,
      metadata: { status },
    });

    res.json(doc);
  } catch {
    res.status(500).json({ error: 'Failed to update verification status' });
  }
});

export default router;
