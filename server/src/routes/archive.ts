import { Router } from 'express';
import { prisma } from '../prismaClient';
import { requireAuth, requireRole, resolveInstitutionId } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { sortByFamilyName } from '../utils/names';

const router = Router();
router.use(requireAuth, requireRole('SYSTEM_ADMIN', 'SECRETARY', 'PRINCIPAL'));

// Graduated (archived) classes, grouped by the year they graduated in.
router.get('/classes', asyncHandler(async (req, res) => {
  const institutionId = resolveInstitutionId(req);
  if (!institutionId) return res.status(400).json({ error: 'לא נבחר מוסד' });

  const classes = await prisma.classRoom.findMany({
    where: { archived: true, grade: { institutionId } },
    include: { grade: true, _count: { select: { students: true } } },
    orderBy: [{ archivedAt: 'desc' }, { name: 'asc' }],
  });

  res.json(
    classes.map((c) => ({
      id: c.id,
      name: c.name,
      gradeName: c.grade.name,
      archivedYearLabel: c.archivedYearLabel,
      studentCount: c._count.students,
    }))
  );
}));

router.get('/classes/:id', asyncHandler(async (req, res) => {
  const institutionId = resolveInstitutionId(req);
  const classRoom = await prisma.classRoom.findUnique({
    where: { id: req.params.id },
    include: {
      grade: true,
      students: { orderBy: { fullName: 'asc' } },
    },
  });
  if (!classRoom || !classRoom.archived) return res.status(404).json({ error: 'כיתה בארכיון לא נמצאה' });
  if (institutionId && classRoom.grade.institutionId !== institutionId) {
    return res.status(403).json({ error: 'אין הרשאה' });
  }

  res.json({
    id: classRoom.id,
    name: classRoom.name,
    gradeName: classRoom.grade.name,
    archivedYearLabel: classRoom.archivedYearLabel,
    students: sortByFamilyName(classRoom.students).map((s) => ({
      fullName: s.fullName,
      nationalId: s.nationalId,
      totalLateCount: s.totalLateCount,
      totalAbsenceCount: s.totalAbsenceCount,
      totalReleaseCount: s.totalReleaseCount,
      totalPeriodsMissed: s.totalPeriodsMissed,
    })),
  });
}));

// Past (ended) semesters - the school's history of terms/years.
router.get('/semesters', asyncHandler(async (req, res) => {
  const institutionId = resolveInstitutionId(req);
  if (!institutionId) return res.status(400).json({ error: 'לא נבחר מוסד' });
  const semesters = await prisma.semester.findMany({
    where: { institutionId, endedAt: { not: null } },
    orderBy: { startedAt: 'desc' },
  });
  res.json(semesters);
}));

// Aggregated attendance stats for one past semester, computed from the
// archived events (student totals are reset at semester end, so this reads
// straight from AttendanceEvent rather than the live counters).
router.get('/semesters/:id', asyncHandler(async (req, res) => {
  const institutionId = resolveInstitutionId(req);
  const semester = await prisma.semester.findUnique({ where: { id: req.params.id } });
  if (!semester) return res.status(404).json({ error: 'מחצית לא נמצאה' });
  if (institutionId && semester.institutionId !== institutionId) {
    return res.status(403).json({ error: 'אין הרשאה' });
  }

  const events = await prisma.attendanceEvent.findMany({
    where: { semesterId: semester.id },
    include: { student: { include: { classRoom: { include: { grade: true } } } } },
  });

  const byStudent = new Map<
    string,
    { fullName: string; nationalId: string; className: string; gradeName: string; late: number; absence: number; release: number }
  >();
  for (const event of events) {
    const key = event.studentId;
    if (!byStudent.has(key)) {
      byStudent.set(key, {
        fullName: event.student.fullName,
        nationalId: event.student.nationalId,
        className: event.student.classRoom.name,
        gradeName: event.student.classRoom.grade.name,
        late: 0,
        absence: 0,
        release: 0,
      });
    }
    const entry = byStudent.get(key)!;
    if (event.type === 'LATE') entry.late += 1;
    else if (event.type === 'ABSENCE') entry.absence += 1;
    else if (event.type === 'RELEASE') entry.release += 1;
  }

  res.json({ semester, students: Array.from(byStudent.values()) });
}));

export default router;
