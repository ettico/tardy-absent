import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prismaClient';
import { requireAuth, requireRole, resolveInstitutionId } from '../middleware/auth';
import { endSemester, yearRollover } from '../services/semester';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
router.use(requireAuth);

// Structural, institution-wide actions. The secretary is the one who
// actually performs these day-to-day, alongside system admin and principal.
router.use(requireRole('SYSTEM_ADMIN', 'SECRETARY', 'PRINCIPAL'));

router.get('/', asyncHandler(async (req, res) => {
  const institutionId = resolveInstitutionId(req);
  if (!institutionId) return res.status(400).json({ error: 'לא נבחר מוסד' });
  const semesters = await prisma.semester.findMany({ where: { institutionId }, orderBy: { startedAt: 'desc' } });
  res.json(semesters);
}));

router.post('/end', asyncHandler(async (req, res) => {
  const institutionId = resolveInstitutionId(req);
  if (!institutionId) return res.status(400).json({ error: 'לא נבחר מוסד' });
  const newSemester = await endSemester(institutionId);
  res.status(201).json(newSemester);
}));

const rolloverSchema = z.object({ newYearLabel: z.string().min(1) });

router.post('/year-rollover', asyncHandler(async (req, res) => {
  const institutionId = resolveInstitutionId(req);
  if (!institutionId) return res.status(400).json({ error: 'לא נבחר מוסד' });
  const parsed = rolloverSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'יש להזין את תווית השנה החדשה (למשל תשפ״ז)' });

  try {
    const result = await yearRollover(institutionId, parsed.data.newYearLabel);
    res.status(200).json(result);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'שגיאה בביצוע מעבר שנה' });
  }
}));

export default router;
