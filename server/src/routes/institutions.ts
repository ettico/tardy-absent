import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prismaClient';
import { requireAuth, requireRole, resolveInstitutionId } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { hasCalendarData } from '../data/schoolCalendar';
import { countInstitutionStudyDays, getOverridesMap } from '../services/calendar';

const router = Router();
router.use(requireAuth);

// Adds the current open semester's planned-end-date and total study-day
// count (Sun-Thu, minus real school vacations/overrides where known) to an
// institution payload - the fixed denominator the severity indicators are
// built on. null when no semester is open yet, or no planned end date was
// set. studyDaysAccurate is true once either the institution has its own
// calendar overrides (an upload or manual edit) or the hardcoded calendar
// covers that semester's year - false means it's a Sun-Thu-only estimate.
async function withStudyDays<T extends { id: string }>(institution: T) {
  const semester = await prisma.semester.findFirst({ where: { institutionId: institution.id, endedAt: null } });
  const plannedEndDate = semester?.plannedEndDate ?? null;
  const semesterStart = semester?.startedAt.toISOString().slice(0, 10);
  const studyDaysTotal =
    plannedEndDate && semesterStart
      ? await countInstitutionStudyDays(institution.id, semesterStart, plannedEndDate, semester!.yearLabel)
      : null;
  const hasOverrides =
    plannedEndDate && semesterStart
      ? (await getOverridesMap(institution.id, semesterStart, plannedEndDate)).size > 0
      : false;
  return {
    ...institution,
    plannedEndDate,
    nextPlannedEndDate: semester?.nextPlannedEndDate ?? null,
    studyDaysTotal,
    studyDaysAccurate: hasOverrides || hasCalendarData(semester?.yearLabel),
  };
}

// Any authenticated role can look up the institution they're currently
// scoped to (a secretary/principal's own institution, or the one a system
// admin has selected) - used to show its name and current school year.
router.get('/current', requireRole('SYSTEM_ADMIN', 'SECRETARY', 'PRINCIPAL'), asyncHandler(async (req, res) => {
  const institutionId = resolveInstitutionId(req);
  if (!institutionId) return res.status(400).json({ error: 'לא נבחר מוסד' });
  const institution = await prisma.institution.findUnique({ where: { id: institutionId } });
  if (!institution) return res.status(404).json({ error: 'מוסד לא נמצא' });
  res.json(await withStudyDays(institution));
}));

// Everything else here manages institutions themselves - global SYSTEM_ADMIN only.
router.use(requireRole('SYSTEM_ADMIN'));

router.get('/', asyncHandler(async (_req, res) => {
  const institutions = await prisma.institution.findMany({
    orderBy: { createdAt: 'asc' },
    include: { _count: { select: { users: true, grades: true } } },
  });
  res.json(await Promise.all(institutions.map(withStudyDays)));
}));

const MAX_LOGO_DATA_URL_LENGTH = 3_000_000; // ~2MB image, base64-inflated

const logoField = z
  .string()
  .refine((v) => v.startsWith('data:image/'), 'הקובץ שהועלה אינו תמונה תקינה')
  .refine((v) => v.length <= MAX_LOGO_DATA_URL_LENGTH, 'התמונה גדולה מדי, יש להעלות עד 2MB')
  .optional();

const createSchema = z.object({
  name: z.string().min(2),
  initialYearLabel: z.string().optional(),
  logoDataUrl: logoField,
  plannedEndDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

router.post('/', asyncHandler(async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.errors[0]?.message ?? 'יש להזין שם מוסד תקין' });
  }
  const institution = await prisma.institution.create({
    data: {
      name: parsed.data.name,
      currentYearLabel: parsed.data.initialYearLabel || null,
      logoDataUrl: parsed.data.logoDataUrl || null,
    },
  });
  await prisma.semester.create({
    data: {
      institutionId: institution.id,
      yearLabel: parsed.data.initialYearLabel || '',
      term: 1,
      plannedEndDate: parsed.data.plannedEndDate || null,
    },
  });
  res.status(201).json(institution);
}));

const updateSchema = z.object({
  name: z.string().min(2).optional(),
  logoDataUrl: z.union([logoField, z.null()]).optional(),
});

router.patch('/:id', asyncHandler(async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.errors[0]?.message ?? 'פרטים לא תקינים' });
  }
  const institution = await prisma.institution.findUnique({ where: { id: req.params.id } });
  if (!institution) return res.status(404).json({ error: 'מוסד לא נמצא' });

  const updated = await prisma.institution.update({ where: { id: institution.id }, data: parsed.data });
  res.json(updated);
}));

export default router;
