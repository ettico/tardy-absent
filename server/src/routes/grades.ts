import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prismaClient';
import { requireAuth, requireRole, resolveInstitutionId } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
router.use(requireAuth);

const PALETTE = ['#6C8EBF', '#82B366', '#D6A44A', '#B85C7A', '#7A6FBF', '#4FA3A0'];

router.get('/', requireRole('SYSTEM_ADMIN', 'SECRETARY', 'PRINCIPAL'), asyncHandler(async (req, res) => {
  const institutionId = resolveInstitutionId(req);
  if (!institutionId) return res.status(400).json({ error: 'לא נבחר מוסד' });

  const grades = await prisma.grade.findMany({
    where: { institutionId },
    orderBy: { order: 'asc' },
    include: {
      classes: {
        where: { archived: false },
        orderBy: { name: 'asc' },
        include: { _count: { select: { students: true } } },
      },
    },
  });
  res.json(grades);
}));

const createSchema = z.object({
  name: z.string().min(1),
  color: z.string().optional(),
});

router.post('/', requireRole('SYSTEM_ADMIN'), asyncHandler(async (req, res) => {
  const institutionId = resolveInstitutionId(req);
  if (!institutionId) return res.status(400).json({ error: 'יש לבחור מוסד' });

  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'יש להזין שם שכבה' });

  const existingCount = await prisma.grade.count({ where: { institutionId } });
  const color = parsed.data.color || PALETTE[existingCount % PALETTE.length];

  try {
    const grade = await prisma.grade.create({
      data: { name: parsed.data.name, color, order: existingCount, institutionId },
    });
    res.status(201).json(grade);
  } catch {
    res.status(409).json({ error: 'שכבה בשם זה כבר קיימת במוסד' });
  }
}));

router.delete('/:id', requireRole('SYSTEM_ADMIN'), asyncHandler(async (req, res) => {
  const institutionId = resolveInstitutionId(req);
  const grade = await prisma.grade.findUnique({ where: { id: req.params.id } });
  if (!grade) return res.status(404).json({ error: 'שכבה לא נמצאה' });
  if (institutionId && grade.institutionId !== institutionId) {
    return res.status(403).json({ error: 'אין הרשאה' });
  }

  await prisma.$transaction([
    prisma.attendanceEvent.deleteMany({ where: { student: { classRoom: { gradeId: grade.id } } } }),
    prisma.student.deleteMany({ where: { classRoom: { gradeId: grade.id } } }),
    prisma.classRoom.deleteMany({ where: { gradeId: grade.id } }),
    prisma.grade.delete({ where: { id: grade.id } }),
  ]);
  res.status(204).send();
}));

export default router;
