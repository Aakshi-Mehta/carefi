import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import Claim from '../models/Claim';
import Patient from '../models/Patient';
import { requireAuth, requireStaff, AuthRequest } from '../middleware/authMiddleware';
import { writeAudit } from '../lib/audit';

const router = Router();

/** GET /api/claims */
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { patientId, status, page = '1', limit = '20', sort = '-createdAt' } = req.query as Record<string, string>;
    const query: Record<string, unknown> = {};
    if (patientId) query.patientId = patientId;
    if (status) query.status = status;

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));

    const [claims, total] = await Promise.all([
      Claim.find(query).sort(sort).skip((pageNum - 1) * limitNum).limit(limitNum).lean(),
      Claim.countDocuments(query),
    ]);

    res.json({ data: claims, pagination: { page: pageNum, limit: limitNum, total } });
  } catch {
    res.status(500).json({ error: 'Failed to fetch claims' });
  }
});

/** POST /api/claims */
router.post('/', requireStaff, async (req: AuthRequest, res: Response) => {
  try {
    const { patientId, insurer, hospital, admissionDate, dischargeDate, totalAmount } = req.body as {
      patientId?: string;
      insurer?: string;
      hospital?: string;
      admissionDate?: string;
      dischargeDate?: string;
      totalAmount?: number;
    };

    if (!patientId || !insurer || !hospital) {
      res.status(400).json({ error: 'patientId, insurer, and hospital are required' });
      return;
    }

    // Verify patient exists
    const patient = await Patient.findOne({ patientId });
    if (!patient) {
      res.status(404).json({ error: `Patient ${patientId} not found` });
      return;
    }

    const claimId = `CLM-${uuidv4().slice(0, 8).toUpperCase()}`;
    const claim = await Claim.create({
      claimId,
      patientId,
      insurer: insurer.trim(),
      hospital: hospital.trim(),
      status: 'OPEN',
      admissionDate: admissionDate ? new Date(admissionDate) : undefined,
      dischargeDate: dischargeDate ? new Date(dischargeDate) : undefined,
      totalAmount,
    });

    await writeAudit({
      actor: req.user!.userId,
      action: 'CLAIM_CREATED',
      resourceType: 'Claim',
      resourceId: claimId,
      metadata: { patientId, insurer, hospital },
    });

    res.status(201).json(claim);
  } catch {
    res.status(500).json({ error: 'Failed to create claim' });
  }
});

/** GET /api/claims/:id */
router.get('/:id', requireAuth, async (_req, res: Response) => {
  try {
    const claim = await Claim.findOne({ claimId: _req.params.id }).lean();
    if (!claim) {
      res.status(404).json({ error: 'Claim not found' });
      return;
    }
    res.json(claim);
  } catch {
    res.status(500).json({ error: 'Failed to fetch claim' });
  }
});

export default router;
