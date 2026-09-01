import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prismaClient';
import { requireAuth, requireRole, resolveInstitutionId } from '../middleware/auth';
import { endSemester, yearRollover, updateCurrentSemesterDates } from '../services/semester';
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

const dateStringField = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'תאריך לא תקין').optional();

const endSchema = z.object({ plannedEndDate: dateStringField });

router.post('/end', asyncHandler(async (req, res) => {
  const institutionId = resolveInstitutionId(req);
  if (!institutionId) return res.status(400).json({ error: 'לא נבחר מוסד' });
  const parsed = endSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'תאריך סיום המחצית אינו תקין' });
  const newSemester = await endSemester(institutionId, parsed.data.plannedEndDate);
  res.status(201).json(newSemester);
}));

const rolloverSchema = z.object({ newYearLabel: z.string().min(1), plannedEndDate: dateStringField });

router.post('/year-rollover', asyncHandler(async (req, res) => {
  const institutionId = resolveInstitutionId(req);
  if (!institutionId) return res.status(400).json({ error: 'לא נבחר מוסד' });
  const parsed = rolloverSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'יש להזין את תווית השנה החדשה (למשל תשפ״ז)' });

  try {
    const result = await yearRollover(institutionId, parsed.data.newYearLabel, parsed.data.plannedEndDate);
    res.status(200).json(result);
  } catch (err) {
    const isKnownDbError = err !== null && typeof err === 'object' && 'code' in err;
    const message = err instanceof Error && !isKnownDbError ? err.message : 'שגיאה בביצוע מעבר שנה. נסי שוב, ואם זה חוזר פני לתמיכה.';
    res.status(400).json({ error: message });
  }
}));

const optionalDateOrNull = z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.null()]).optional();

const updateDatesSchema = z.object({
  plannedEndDate: optionalDateOrNull,
  nextPlannedEndDate: optionalDateOrNull,
});

router.patch('/current', asyncHandler(async (req, res) => {
  const institutionId = resolveInstitutionId(req);
  if (!institutionId) return res.status(400).json({ error: 'לא נבחר מוסד' });
  const parsed = updateDatesSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'תאריך לא תקין' });

  try {
    const updated = await updateCurrentSemesterDates(institutionId, parsed.data);
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'שגיאה בעדכון תאריכי המחצית' });
  }
}));

export default router;
