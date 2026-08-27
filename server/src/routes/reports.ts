import { Router } from 'express';
import { prisma } from '../prismaClient';
import { requireAuth, requireRole, resolveInstitutionId } from '../middleware/auth';
import { sendAsExcel } from '../utils/excelExport';
import { toHebrewDateString } from '../utils/hebrewDate';

const router = Router();
router.use(requireAuth, requireRole('SYSTEM_ADMIN', 'SECRETARY', 'PRINCIPAL'));

const EVENT_LABELS: Record<string, string> = { LATE: 'איחור', ABSENCE: 'חיסור', RELEASE: 'שחרור' };

function statusLabel(student: { blocked: boolean; needsAssignment: boolean }): string {
  if (student.blocked) return 'אין רשות כניסה לכיתה';
  if (student.needsAssignment) return 'נדרשת להגיש עבודה';
  return '';
}

// Attendance summary report for a class - counts only.
router.get('/class/:classId', async (req, res) => {
  const institutionId = resolveInstitutionId(req);
  const classRoom = await prisma.classRoom.findUnique({
    where: { id: req.params.classId },
    include: { grade: true, students: { orderBy: { fullName: 'asc' } } },
  });
  if (!classRoom) return res.status(404).json({ error: 'כיתה לא נמצאה' });
  if (institutionId && classRoom.grade.institutionId !== institutionId) {
    return res.status(403).json({ error: 'אין הרשאה' });
  }

  const rows = classRoom.students.map((s) => ({
    fullName: s.fullName,
    nationalId: s.nationalId,
    totalLateCount: s.totalLateCount,
    totalAbsenceCount: s.totalAbsenceCount,
    totalReleaseCount: s.totalReleaseCount,
    needsAssignment: s.needsAssignment,
    blocked: s.blocked,
    status: statusLabel(s),
  }));

  if (req.query.format === 'xlsx') {
    return sendAsExcel(
      res,
      `דוח-כיתה-${classRoom.name}.xlsx`,
      [
        { header: 'שם התלמידה', key: 'fullName', width: 24 },
        { header: 'ת.ז.', key: 'nationalId', width: 14 },
        { header: 'סה"כ איחורים', key: 'totalLateCount', width: 14 },
        { header: 'סה"כ חיסורים', key: 'totalAbsenceCount', width: 14 },
        { header: 'סה"כ שחרורים', key: 'totalReleaseCount', width: 14 },
        { header: 'סטטוס', key: 'status', width: 22 },
      ],
      rows
    );
  }

  res.json({
    className: classRoom.name,
    gradeName: classRoom.grade.name,
    generatedAt: new Date().toISOString(),
    students: rows,
  });
});

// Detailed booklet for a class - per student, full list of event dates.
router.get('/class/:classId/booklet', async (req, res) => {
  const institutionId = resolveInstitutionId(req);
  const classRoom = await prisma.classRoom.findUnique({
    where: { id: req.params.classId },
    include: {
      grade: true,
      students: {
        orderBy: { fullName: 'asc' },
        include: { events: { orderBy: [{ date: 'asc' }, { createdAt: 'asc' }] } },
      },
    },
  });
  if (!classRoom) return res.status(404).json({ error: 'כיתה לא נמצאה' });
  if (institutionId && classRoom.grade.institutionId !== institutionId) {
    return res.status(403).json({ error: 'אין הרשאה' });
  }

  const studentsWithHebrewDates = await Promise.all(
    classRoom.students.map(async (s) => ({
      fullName: s.fullName,
      nationalId: s.nationalId,
      totalLateCount: s.totalLateCount,
      totalAbsenceCount: s.totalAbsenceCount,
      totalReleaseCount: s.totalReleaseCount,
      status: statusLabel(s),
      events: await Promise.all(
        s.events.map(async (e) => ({
          type: e.type,
          typeLabel: EVENT_LABELS[e.type],
          date: e.date,
          hebrewDate: await toHebrewDateString(e.date),
          time: e.time,
        }))
      ),
    }))
  );

  if (req.query.format === 'xlsx') {
    const rows = studentsWithHebrewDates.flatMap((s) =>
      s.events.map((e) => ({
        fullName: s.fullName,
        nationalId: s.nationalId,
        type: e.typeLabel,
        hebrewDate: e.hebrewDate,
        time: e.time ?? '',
      }))
    );
    return sendAsExcel(
      res,
      `חוברת-כיתה-${classRoom.name}.xlsx`,
      [
        { header: 'שם התלמידה', key: 'fullName', width: 24 },
        { header: 'ת.ז.', key: 'nationalId', width: 14 },
        { header: 'סוג', key: 'type', width: 12 },
        { header: 'תאריך עברי', key: 'hebrewDate', width: 26 },
        { header: 'שעה', key: 'time', width: 10 },
      ],
      rows
    );
  }

  res.json({ className: classRoom.name, gradeName: classRoom.grade.name, students: studentsWithHebrewDates });
});

// Institution-wide: students who reached the 8-late assignment threshold at
// least once this semester, including those currently blocked / referred to
// administration. assignmentsRequired never resets except on semester-end,
// so it stays true to "at least once this semester" even after a student
// submits an assignment and her cycle counter resets.
router.get('/at-risk', async (req, res) => {
  const institutionId = resolveInstitutionId(req);
  if (!institutionId) return res.status(400).json({ error: 'לא נבחר מוסד' });

  const students = await prisma.student.findMany({
    where: { assignmentsRequired: { gt: 0 }, classRoom: { archived: false, grade: { institutionId } } },
    include: { classRoom: { include: { grade: true } } },
    orderBy: [{ classRoom: { grade: { order: 'asc' } } }, { fullName: 'asc' }],
  });

  const rows = students.map((s) => ({
    fullName: s.fullName,
    nationalId: s.nationalId,
    gradeName: s.classRoom.grade.name,
    className: s.classRoom.name,
    totalLateCount: s.totalLateCount,
    assignmentsRequired: s.assignmentsRequired,
    assignmentsSubmitted: s.assignmentsSubmitted,
    assignmentsOwed: s.assignmentsRequired - s.assignmentsSubmitted,
    status: s.blocked ? 'הופנתה להנהלה' : s.needsAssignment ? 'ממתינה להגשת עבודה' : 'טופל',
  }));

  if (req.query.format === 'xlsx') {
    return sendAsExcel(
      res,
      'תלמידות-בחריגה.xlsx',
      [
        { header: 'שם התלמידה', key: 'fullName', width: 24 },
        { header: 'ת.ז.', key: 'nationalId', width: 14 },
        { header: 'שכבה', key: 'gradeName', width: 10 },
        { header: 'כיתה', key: 'className', width: 10 },
        { header: 'סה"כ איחורים', key: 'totalLateCount', width: 14 },
        { header: 'פעמים נדרשה עבודה', key: 'assignmentsRequired', width: 18 },
        { header: 'עבודות ממתינות', key: 'assignmentsOwed', width: 16 },
        { header: 'סטטוס', key: 'status', width: 20 },
      ],
      rows
    );
  }

  res.json({ students: rows });
});

// School-wide summary for the principal - aggregated per grade + totals.
router.get('/institution-summary', async (req, res) => {
  const institutionId = resolveInstitutionId(req);
  if (!institutionId) return res.status(400).json({ error: 'לא נבחר מוסד' });

  const grades = await prisma.grade.findMany({
    where: { institutionId },
    orderBy: { order: 'asc' },
    include: { classes: { where: { archived: false }, include: { students: true } } },
  });

  const gradeRows = grades.map((grade) => {
    const students = grade.classes.flatMap((c) => c.students);
    return {
      gradeName: grade.name,
      studentCount: students.length,
      totalLateCount: students.reduce((sum, s) => sum + s.totalLateCount, 0),
      totalAbsenceCount: students.reduce((sum, s) => sum + s.totalAbsenceCount, 0),
      totalReleaseCount: students.reduce((sum, s) => sum + s.totalReleaseCount, 0),
      studentsNeedingAssignment: students.filter((s) => s.assignmentsRequired > 0).length,
      studentsBlocked: students.filter((s) => s.blocked).length,
    };
  });

  const totals = gradeRows.reduce(
    (acc, g) => ({
      studentCount: acc.studentCount + g.studentCount,
      totalLateCount: acc.totalLateCount + g.totalLateCount,
      totalAbsenceCount: acc.totalAbsenceCount + g.totalAbsenceCount,
      totalReleaseCount: acc.totalReleaseCount + g.totalReleaseCount,
      studentsNeedingAssignment: acc.studentsNeedingAssignment + g.studentsNeedingAssignment,
      studentsBlocked: acc.studentsBlocked + g.studentsBlocked,
    }),
    { studentCount: 0, totalLateCount: 0, totalAbsenceCount: 0, totalReleaseCount: 0, studentsNeedingAssignment: 0, studentsBlocked: 0 }
  );

  if (req.query.format === 'xlsx') {
    return sendAsExcel(
      res,
      'סיכום-בית-ספר.xlsx',
      [
        { header: 'שכבה', key: 'gradeName', width: 10 },
        { header: 'מספר תלמידות', key: 'studentCount', width: 14 },
        { header: 'סה"כ איחורים', key: 'totalLateCount', width: 14 },
        { header: 'סה"כ חיסורים', key: 'totalAbsenceCount', width: 14 },
        { header: 'סה"כ שחרורים', key: 'totalReleaseCount', width: 14 },
        { header: 'תלמידות שנדרשו להגיש עבודה', key: 'studentsNeedingAssignment', width: 22 },
        { header: 'תלמידות ללא רשות כניסה', key: 'studentsBlocked', width: 20 },
      ],
      [...gradeRows, { gradeName: 'סה"כ', ...totals }]
    );
  }

  res.json({ grades: gradeRows, totals, generatedAt: new Date().toISOString() });
});

export default router;
