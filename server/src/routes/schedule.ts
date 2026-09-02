import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prismaClient';
import { requireAuth, requireRole, resolveInstitutionId } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
router.use(requireAuth, requireRole('SYSTEM_ADMIN', 'SECRETARY', 'PRINCIPAL'));

const WEEKDAYS = [0, 1, 2, 3, 4]; // Sunday..Thursday

// One screen's worth of data: the institution's bell schedule, plus every
// active class's period count for each weekday (null where not configured
// yet) - drives the schedule settings page's period-times table and the
// classes x weekdays grid in one shot.
router.get('/', asyncHandler(async (req, res) => {
  const institutionId = resolveInstitutionId(req);
  if (!institutionId) return res.status(400).json({ error: 'לא נבחר מוסד' });

  const periods = await prisma.schedulePeriod.findMany({
    where: { institutionId },
    orderBy: { periodNumber: 'asc' },
  });

  const classes = await prisma.classRoom.findMany({
    where: { archived: false, grade: { institutionId } },
    include: { grade: true, daySchedules: true },
    orderBy: [{ grade: { order: 'asc' } }, { name: 'asc' }],
  });

  const classDays = classes.flatMap((c) =>
    WEEKDAYS.map((weekday) => ({
      classId: c.id,
      className: c.name,
      gradeName: c.grade.name,
      weekday,
      periodsCount: c.daySchedules.find((d) => d.weekday === weekday)?.periodsCount ?? null,
    }))
  );

  res.json({ periods, classDays });
}));

const periodSchema = z.object({
  periodNumber: z.number().int().min(1),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'שעה לא תקינה'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'שעה לא תקינה'),
});
const periodsSchema = z.object({ periods: z.array(periodSchema) });

// Replaces the institution's whole bell schedule at once - it's a short list
// (one row per lesson period) that's edited as a unit, unlike the per-class
// day counts below which are single-cell updates.
router.put('/periods', asyncHandler(async (req, res) => {
  const institutionId = resolveInstitutionId(req);
  if (!institutionId) return res.status(400).json({ error: 'לא נבחר מוסד' });
  const parsed = periodsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'נתונים לא תקינים' });

  const sorted = [...parsed.data.periods].sort((a, b) => a.periodNumber - b.periodNumber);
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].endTime <= sorted[i].startTime) {
      return res.status(400).json({ error: `שיעור ${sorted[i].periodNumber}: שעת הסיום חייבת להיות אחרי שעת ההתחלה` });
    }
    if (i > 0 && sorted[i].startTime < sorted[i - 1].endTime) {
      return res.status(400).json({ error: 'שעות השיעורים חופפות זו את זו' });
    }
  }

  await prisma.$transaction([
    prisma.schedulePeriod.deleteMany({ where: { institutionId } }),
    prisma.schedulePeriod.createMany({ data: sorted.map((p) => ({ ...p, institutionId })) }),
  ]);
  res.json({ ok: true });
}));

const classDaySchema = z.object({
  classId: z.string().min(1),
  weekday: z.number().int().min(0).max(4),
  periodsCount: z.number().int().min(0).max(20),
});

// Single-cell update for the classes x weekdays grid - meant to be called on
// every edit, not as a batch re-upload, so a mid-year schedule tweak (one
// class ending earlier on one day) is a one-field save.
router.put('/class-day', asyncHandler(async (req, res) => {
  const institutionId = resolveInstitutionId(req);
  const parsed = classDaySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'נתונים לא תקינים' });

  const classRoom = await prisma.classRoom.findUnique({ where: { id: parsed.data.classId }, include: { grade: true } });
  if (!classRoom) return res.status(404).json({ error: 'כיתה לא נמצאה' });
  if (institutionId && classRoom.grade.institutionId !== institutionId) {
    return res.status(403).json({ error: 'אין הרשאה' });
  }

  const row = await prisma.classDaySchedule.upsert({
    where: { classId_weekday: { classId: parsed.data.classId, weekday: parsed.data.weekday } },
    create: { classId: parsed.data.classId, weekday: parsed.data.weekday, periodsCount: parsed.data.periodsCount },
    update: { periodsCount: parsed.data.periodsCount },
  });
  res.json(row);
}));

export default router;
