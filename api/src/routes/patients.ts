import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import Patient from '../models/Patient';
import { requireAuth, requireStaff, AuthRequest } from '../middleware/authMiddleware';
import { writeAudit } from '../lib/audit';

const router = Router();

/** GET /api/patients — list with search, sort, pagination */
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { search, page = '1', limit = '20', sort = '-createdAt' } = req.query as Record<string, string>;

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    // Build query
    const query: Record<string, unknown> = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { patientId: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
      ];
    }

    const [patients, total] = await Promise.all([
      Patient.find(query).sort(sort).skip(skip).limit(limitNum).lean(),
      Patient.countDocuments(query),
    ]);

    res.json({
      data: patients,
      pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
    });
  } catch (err) {
    console.error('[Patients] List error:', err);
    res.status(500).json({ error: 'Failed to fetch patients' });
  }
});

/** POST /api/patients */
router.post('/', requireStaff, async (req: AuthRequest, res: Response) => {
  try {
    const { name, phone, email, dateOfBirth } = req.body as {
      name?: string;
      phone?: string;
      email?: string;
      dateOfBirth?: string;
    };

    if (!name || !phone || !email) {
      res.status(400).json({ error: 'name, phone, and email are required' });
      return;
    }

    // Check for duplicate email
    const existing = await Patient.findOne({ email: email.toLowerCase() });
    if (existing) {
      res.status(409).json({ error: 'A patient with this email already exists', existingId: existing.patientId });
      return;
    }

    const patientId = `PAT-${uuidv4().slice(0, 8).toUpperCase()}`;
    const patient = await Patient.create({
      patientId,
      name: name.trim(),
      phone: phone.trim(),
      email: email.toLowerCase().trim(),
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
    });

    await writeAudit({
      actor: req.user!.userId,
      action: 'PATIENT_CREATED',
      resourceType: 'Patient',
      resourceId: patientId,
      metadata: { name: patient.name },
    });

    res.status(201).json(patient);
  } catch (err) {
    console.error('[Patients] Create error:', err);
    res.status(500).json({ error: 'Failed to create patient' });
  }
});

/** GET /api/patients/:id */
router.get('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const patient = await Patient.findOne({ patientId: req.params.id }).lean();
    if (!patient) {
      res.status(404).json({ error: 'Patient not found' });
      return;
    }
    res.json(patient);
  } catch {
    res.status(500).json({ error: 'Failed to fetch patient' });
  }
});

/** PATCH /api/patients/:id */
router.patch('/:id', requireStaff, async (req: AuthRequest, res: Response) => {
  try {
    const allowed = ['name', 'phone', 'email', 'dateOfBirth'];
    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: 'No valid fields to update' });
      return;
    }

    const patient = await Patient.findOneAndUpdate(
      { patientId: req.params.id },
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!patient) {
      res.status(404).json({ error: 'Patient not found' });
      return;
    }

    await writeAudit({
      actor: req.user!.userId,
      action: 'PATIENT_UPDATED',
      resourceType: 'Patient',
      resourceId: req.params.id,
      metadata: { updates },
    });

    res.json(patient);
  } catch {
    res.status(500).json({ error: 'Failed to update patient' });
  }
});

export default router;
