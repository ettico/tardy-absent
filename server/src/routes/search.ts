import { Router } from 'express';
import { prisma } from '../prismaClient';
import { requireAuth, requireRole, resolveInstitutionId } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
router.use(requireAuth, requireRole('SYSTEM_ADMIN', 'SECRETARY', 'PRINCIPAL'));

router.get('/', asyncHandler(async (req, res) => {
  const institutionId = resolveInstitutionId(req);
  const q = String(req.query.q ?? '').trim();
  if (!institutionId || q.length < 2) {
    return res.json({ students: [], classes: [] });
  }

  const [students, classes] = await Promise.all([
    prisma.student.findMany({
      where: { fullName: { contains: q }, classRoom: { archived: false, grade: { institutionId } } },
      include: { classRoom: { include: { grade: true } } },
      take: 15,
      orderBy: { fullName: 'asc' },
    }),
    prisma.classRoom.findMany({
      where: { name: { contains: q }, archived: false, grade: { institutionId } },
      include: { grade: true },
      take: 10,
      orderBy: { name: 'asc' },
    }),
  ]);

  res.json({
    students: students.map((s) => ({
      id: s.id,
      fullName: s.fullName,
      className: s.classRoom.name,
      gradeName: s.classRoom.grade.name,
    })),
    classes: classes.map((c) => ({ id: c.id, name: c.name, gradeName: c.grade.name })),
  });
}));

export default router;
