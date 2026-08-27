import { Router } from 'express';
import { prisma } from '../prismaClient';
import { requireAuth, requireRole, resolveInstitutionId } from '../middleware/auth';

const router = Router();
router.use(requireAuth, requireRole('SYSTEM_ADMIN', 'SECRETARY', 'PRINCIPAL'));

// Attendance summary report for a class - meant for printing for the teacher.
router.get('/class/:classId', async (req, res) => {
  const institutionId = resolveInstitutionId(req);
  const classRoom = await prisma.classRoom.findUnique({
    where: { id: req.params.classId },
    include: {
      grade: true,
      students: { orderBy: { fullName: 'asc' } },
    },
  });
  if (!classRoom) return res.status(404).json({ error: 'כיתה לא נמצאה' });
  if (institutionId && classRoom.grade.institutionId !== institutionId) {
    return res.status(403).json({ error: 'אין הרשאה' });
  }

  res.json({
    className: classRoom.name,
    gradeName: classRoom.grade.name,
    generatedAt: new Date().toISOString(),
    students: classRoom.students.map((s) => ({
      fullName: s.fullName,
      nationalId: s.nationalId,
      totalLateCount: s.totalLateCount,
      totalAbsenceCount: s.totalAbsenceCount,
      totalReleaseCount: s.totalReleaseCount,
      needsAssignment: s.needsAssignment,
      blocked: s.blocked,
    })),
  });
});

export default router;
