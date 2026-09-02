import { Router } from 'express';
import { prisma } from '../prismaClient';
import { requireAuth, requireRole, resolveInstitutionId } from '../middleware/auth';
import { sendAsExcel } from '../utils/excelExport';
import { toHebrewDateString, toHebrewMonthKey } from '../utils/hebrewDate';
import { asyncHandler } from '../utils/asyncHandler';
import { compareByFamilyName, sortByFamilyName } from '../utils/names';

const router = Router();
router.use(requireAuth);

// Class-level reports (summary + booklet) are day-to-day secretary tools.
// The cross-grade "at risk" report and the management dashboard's data are
// restricted to system admin and the school principal only.
const anyStaffRole = requireRole('SYSTEM_ADMIN', 'SECRETARY', 'PRINCIPAL');
const managementOnly = requireRole('SYSTEM_ADMIN', 'PRINCIPAL');

const EVENT_LABELS: Record<string, string> = { LATE: 'איחור', ABSENCE: 'חיסור', RELEASE: 'שחרור' };

function statusLabel(student: { blocked: boolean; needsAssignment: boolean }): string {
  if (student.blocked) return 'אין רשות כניסה לכיתה';
  if (student.needsAssignment) return 'נדרשת להגיש עבודה';
  return '';
}

// Attendance summary report for a class - counts only.
router.get('/class/:classId', anyStaffRole, asyncHandler(async (req, res) => {
  const institutionId = resolveInstitutionId(req);
  const classRoom = await prisma.classRoom.findUnique({
    where: { id: req.params.classId },
    include: { grade: true, students: { orderBy: { fullName: 'asc' } } },
  });
  if (!classRoom) return res.status(404).json({ error: 'כיתה לא נמצאה' });
  if (institutionId && classRoom.grade.institutionId !== institutionId) {
    return res.status(403).json({ error: 'אין הרשאה' });
  }

  const rows = sortByFamilyName(classRoom.students).map((s) => ({
    fullName: s.fullName,
    nationalId: s.nationalId,
    totalLateCount: s.totalLateCount,
    totalAbsenceCount: s.totalAbsenceCount,
    totalReleaseCount: s.totalReleaseCount,
    totalPeriodsMissed: s.totalPeriodsMissed,
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
        { header: 'סה"כ חיסורי שעות', key: 'totalPeriodsMissed', width: 16 },
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
}));

// Detailed booklet for a class - per student, full list of event dates.
router.get('/class/:classId/booklet', anyStaffRole, asyncHandler(async (req, res) => {
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
    sortByFamilyName(classRoom.students).map(async (s) => ({
      fullName: s.fullName,
      nationalId: s.nationalId,
      totalLateCount: s.totalLateCount,
      totalAbsenceCount: s.totalAbsenceCount,
      totalReleaseCount: s.totalReleaseCount,
      totalPeriodsMissed: s.totalPeriodsMissed,
      status: statusLabel(s),
      events: await Promise.all(
        s.events.map(async (e) => ({
          type: e.type,
          typeLabel: EVENT_LABELS[e.type],
          date: e.date,
          hebrewDate: await toHebrewDateString(e.date),
          time: e.time,
          periodsMissed: e.periodsMissed,
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
        periodsMissed: e.periodsMissed ?? '',
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
        { header: 'חיסורי שעות', key: 'periodsMissed', width: 14 },
      ],
      rows
    );
  }

  res.json({ className: classRoom.name, gradeName: classRoom.grade.name, students: studentsWithHebrewDates });
}));

// Institution-wide: students who reached the 8-late assignment threshold at
// least once this semester, including those currently blocked / referred to
// administration. assignmentsRequired never resets except on semester-end,
// so it stays true to "at least once this semester" even after a student
// submits an assignment and her cycle counter resets.
router.get('/at-risk', managementOnly, asyncHandler(async (req, res) => {
  const institutionId = resolveInstitutionId(req);
  if (!institutionId) return res.status(400).json({ error: 'לא נבחר מוסד' });

  const students = await prisma.student.findMany({
    where: { assignmentsRequired: { gt: 0 }, classRoom: { archived: false, grade: { institutionId } } },
    include: { classRoom: { include: { grade: true } } },
    orderBy: [{ classRoom: { grade: { order: 'asc' } } }],
  });
  students.sort((a, b) => a.classRoom.grade.order - b.classRoom.grade.order || compareByFamilyName(a, b));

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
}));

// School-wide summary for the principal - aggregated per grade + totals.
router.get('/institution-summary', managementOnly, asyncHandler(async (req, res) => {
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
      totalPeriodsMissed: students.reduce((sum, s) => sum + s.totalPeriodsMissed, 0),
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
      totalPeriodsMissed: acc.totalPeriodsMissed + g.totalPeriodsMissed,
      studentsNeedingAssignment: acc.studentsNeedingAssignment + g.studentsNeedingAssignment,
      studentsBlocked: acc.studentsBlocked + g.studentsBlocked,
    }),
    { studentCount: 0, totalLateCount: 0, totalAbsenceCount: 0, totalReleaseCount: 0, totalPeriodsMissed: 0, studentsNeedingAssignment: 0, studentsBlocked: 0 }
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
        { header: 'סה"כ חיסורי שעות', key: 'totalPeriodsMissed', width: 16 },
        { header: 'תלמידות שנדרשו להגיש עבודה', key: 'studentsNeedingAssignment', width: 22 },
        { header: 'תלמידות ללא רשות כניסה', key: 'studentsBlocked', width: 20 },
      ],
      [...gradeRows, { gradeName: 'סה"כ', ...totals }]
    );
  }

  res.json({ grades: gradeRows, totals, generatedAt: new Date().toISOString() });
}));

// Institution-wide totals per active class - for the management dashboard's
// "which classes have the most" comparison chart.
router.get('/by-class-totals', managementOnly, asyncHandler(async (req, res) => {
  const institutionId = resolveInstitutionId(req);
  if (!institutionId) return res.status(400).json({ error: 'לא נבחר מוסד' });

  const classes = await prisma.classRoom.findMany({
    where: { archived: false, grade: { institutionId } },
    include: { grade: true, students: true },
    orderBy: [{ grade: { order: 'asc' } }, { name: 'asc' }],
  });

  res.json(
    classes.map((c) => ({
      className: c.name,
      gradeName: c.grade.name,
      late: c.students.reduce((sum, s) => sum + s.totalLateCount, 0),
      absence: c.students.reduce((sum, s) => sum + s.totalAbsenceCount, 0),
      release: c.students.reduce((sum, s) => sum + s.totalReleaseCount, 0),
    }))
  );
}));

// A class's events for the current semester, grouped by Hebrew month - the
// dashboard's monthly trend chart (with the peak month called out).
router.get('/class/:classId/by-month', managementOnly, asyncHandler(async (req, res) => {
  const institutionId = resolveInstitutionId(req);
  const classRoom = await prisma.classRoom.findUnique({
    where: { id: req.params.classId },
    include: { grade: true },
  });
  if (!classRoom) return res.status(404).json({ error: 'כיתה לא נמצאה' });
  if (institutionId && classRoom.grade.institutionId !== institutionId) {
    return res.status(403).json({ error: 'אין הרשאה' });
  }

  const currentSemester = await prisma.semester.findFirst({
    where: { institutionId: classRoom.grade.institutionId, endedAt: null },
  });

  const events = currentSemester
    ? await prisma.attendanceEvent.findMany({
        where: { semesterId: currentSemester.id, student: { classId: classRoom.id }, type: { in: ['LATE', 'ABSENCE'] } },
      })
    : [];

  const byMonth = new Map<number, { label: string; late: number; absence: number }>();
  for (const event of events) {
    const { label, sortKey } = await toHebrewMonthKey(event.date);
    if (!byMonth.has(sortKey)) byMonth.set(sortKey, { label, late: 0, absence: 0 });
    const entry = byMonth.get(sortKey)!;
    if (event.type === 'LATE') entry.late += 1;
    else if (event.type === 'ABSENCE') entry.absence += 1;
  }

  const months = Array.from(byMonth.entries())
    .sort(([a], [b]) => a - b)
    .map(([, value]) => value);

  res.json({ className: classRoom.name, gradeName: classRoom.grade.name, months });
}));

// Lateness report for a class - per-student approved vs. unapproved late
// counts, plus a monthly breakdown for the whole class this semester.
router.get('/class/:classId/lateness', anyStaffRole, asyncHandler(async (req, res) => {
  const institutionId = resolveInstitutionId(req);
  const classRoom = await prisma.classRoom.findUnique({
    where: { id: req.params.classId },
    include: { grade: true, students: true },
  });
  if (!classRoom) return res.status(404).json({ error: 'כיתה לא נמצאה' });
  if (institutionId && classRoom.grade.institutionId !== institutionId) {
    return res.status(403).json({ error: 'אין הרשאה' });
  }

  const rows = sortByFamilyName(classRoom.students).map((s) => ({
    fullName: s.fullName,
    nationalId: s.nationalId,
    totalLateApprovedCount: s.totalLateApprovedCount,
    totalLateUnapprovedCount: s.totalLateUnapprovedCount,
    totalLateCount: s.totalLateCount,
    totalPeriodsMissed: s.totalPeriodsMissed,
  }));

  const currentSemester = await prisma.semester.findFirst({
    where: { institutionId: classRoom.grade.institutionId, endedAt: null },
  });
  const lateEvents = currentSemester
    ? await prisma.attendanceEvent.findMany({
        where: { semesterId: currentSemester.id, type: 'LATE', student: { classId: classRoom.id } },
      })
    : [];

  const byMonth = new Map<number, { label: string; approved: number; unapproved: number }>();
  for (const event of lateEvents) {
    const { label, sortKey } = await toHebrewMonthKey(event.date);
    if (!byMonth.has(sortKey)) byMonth.set(sortKey, { label, approved: 0, unapproved: 0 });
    const entry = byMonth.get(sortKey)!;
    if (event.lateApproved) entry.approved += 1;
    else entry.unapproved += 1;
  }
  const months = Array.from(byMonth.entries())
    .sort(([a], [b]) => a - b)
    .map(([, value]) => value);

  if (req.query.format === 'xlsx') {
    return sendAsExcel(
      res,
      `דוח-איחורים-${classRoom.name}.xlsx`,
      [
        { header: 'שם התלמידה', key: 'fullName', width: 24 },
        { header: 'ת.ז.', key: 'nationalId', width: 14 },
        { header: 'איחורים עם אישור', key: 'totalLateApprovedCount', width: 16 },
        { header: 'איחורים ללא אישור', key: 'totalLateUnapprovedCount', width: 18 },
        { header: 'סה"כ איחורים', key: 'totalLateCount', width: 14 },
        { header: 'סה"כ חיסורי שעות', key: 'totalPeriodsMissed', width: 16 },
      ],
      rows
    );
  }

  res.json({
    className: classRoom.name,
    gradeName: classRoom.grade.name,
    generatedAt: new Date().toISOString(),
    students: rows,
    months,
  });
}));

export default router;
