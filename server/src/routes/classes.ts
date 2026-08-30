import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prismaClient';
import { requireAuth, requireRole, resolveInstitutionId } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
router.use(requireAuth);

async function assertGradeInScope(gradeId: string, institutionId: string | null) {
  const grade = await prisma.grade.findUnique({ where: { id: gradeId } });
  if (!grade) return null;
  if (institutionId && grade.institutionId !== institutionId) return null;
  return grade;
}

router.get('/:id', requireRole('SYSTEM_ADMIN', 'SECRETARY', 'PRINCIPAL'), asyncHandler(async (req, res) => {
  const institutionId = resolveInstitutionId(req);
  const classRoom = await prisma.classRoom.findUnique({
    where: { id: req.params.id },
    include: { grade: true, students: { orderBy: { fullName: 'asc' } } },
  });
  if (!classRoom) return res.status(404).json({ error: 'כיתה לא נמצאה' });
  if (institutionId && classRoom.grade.institutionId !== institutionId) {
    return res.status(403).json({ error: 'אין הרשאה לצפות בכיתה זו' });
  }
  res.json(classRoom);
}));

const createSchema = z.object({
  name: z.string().min(1),
  gradeId: z.string().min(1),
});

router.post('/', requireRole('SYSTEM_ADMIN', 'SECRETARY'), asyncHandler(async (req, res) => {
  const institutionId = resolveInstitutionId(req);
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'יש להזין שם כיתה ושכבה' });

  const grade = await assertGradeInScope(parsed.data.gradeId, institutionId);
  if (!grade) return res.status(400).json({ error: 'שכבה לא נמצאה' });

  try {
    const classRoom = await prisma.classRoom.create({
      data: { name: parsed.data.name, gradeId: grade.id },
    });
    res.status(201).json(classRoom);
  } catch {
    res.status(409).json({ error: 'כיתה בשם זה כבר קיימת בשכבה' });
  }
}));

const updateSchema = z.object({ name: z.string().min(1) });

router.patch('/:id', requireRole('SYSTEM_ADMIN', 'SECRETARY'), asyncHandler(async (req, res) => {
  const institutionId = resolveInstitutionId(req);
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'יש להזין שם כיתה' });

  const classRoom = await prisma.classRoom.findUnique({ where: { id: req.params.id }, include: { grade: true } });
  if (!classRoom) return res.status(404).json({ error: 'כיתה לא נמצאה' });
  if (institutionId && classRoom.grade.institutionId !== institutionId) {
    return res.status(403).json({ error: 'אין הרשאה' });
  }

  const updated = await prisma.classRoom.update({ where: { id: req.params.id }, data: { name: parsed.data.name } });
  res.json(updated);
}));

router.delete('/:id', requireRole('SYSTEM_ADMIN', 'SECRETARY'), asyncHandler(async (req, res) => {
  const institutionId = resolveInstitutionId(req);
  const classRoom = await prisma.classRoom.findUnique({ where: { id: req.params.id }, include: { grade: true } });
  if (!classRoom) return res.status(404).json({ error: 'כיתה לא נמצאה' });
  if (institutionId && classRoom.grade.institutionId !== institutionId) {
    return res.status(403).json({ error: 'אין הרשאה' });
  }
  await prisma.$transaction([
    prisma.attendanceEvent.deleteMany({ where: { student: { classId: classRoom.id } } }),
    prisma.student.deleteMany({ where: { classId: classRoom.id } }),
    prisma.classRoom.delete({ where: { id: classRoom.id } }),
  ]);
  res.status(204).send();
}));

export default router;
