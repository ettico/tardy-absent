import { Router } from 'express';
import multer from 'multer';
import ExcelJS from 'exceljs';
import { z } from 'zod';
import { prisma } from '../prismaClient';
import { requireAuth, requireRole, resolveInstitutionId } from '../middleware/auth';
import { markAbsence, markLate, markRelease, submitAssignment, removeAttendanceEvents, NotFoundError } from '../services/attendance';
import { asyncHandler } from '../utils/asyncHandler';
import { countStudyDays, eachDate, todayDateString } from '../utils/dates';
import { toHebrewMonthKey } from '../utils/hebrewDate';
import { hasCalendarData } from '../data/schoolCalendar';
import { getOverridesMap } from '../services/calendar';

const router = Router();
router.use(requireAuth);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

async function classInScope(classId: string, institutionId: string | null) {
  const classRoom = await prisma.classRoom.findUnique({ where: { id: classId }, include: { grade: true } });
  if (!classRoom) return null;
  if (institutionId && classRoom.grade.institutionId !== institutionId) return null;
  return classRoom;
}

async function studentInScope(studentId: string, institutionId: string | null) {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: { classRoom: { include: { grade: true } } },
  });
  if (!student) return null;
  if (institutionId && student.classRoom.grade.institutionId !== institutionId) return null;
  return student;
}

router.get('/:id', requireRole('SYSTEM_ADMIN', 'SECRETARY', 'PRINCIPAL'), asyncHandler(async (req, res) => {
  const institutionId = resolveInstitutionId(req);
  const student = await studentInScope(req.params.id, institutionId);
  if (!student) return res.status(404).json({ error: 'תלמידה לא נמצאה' });
  const events = await prisma.attendanceEvent.findMany({
    where: { studentId: student.id },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
  });
  res.json({ ...student, events });
}));

// Per-month breakdown for the current semester - late/absence/release counts
// plus the (holiday-aware) study-day count for the WHOLE month, so a month's
// scale stays stable and meaningful throughout - not shrinking to whatever
// has merely elapsed so far (which would make one early-month event read as
// a much bigger share than it is). Covers every month of the semester up to
// its planned end date if set, else up to today; a month is only clipped at
// the semester's own start/end edges, never at "today" mid-month.
router.get('/:id/monthly', requireRole('SYSTEM_ADMIN', 'SECRETARY', 'PRINCIPAL'), asyncHandler(async (req, res) => {
  const institutionId = resolveInstitutionId(req);
  const student = await studentInScope(req.params.id, institutionId);
  if (!student) return res.status(404).json({ error: 'תלמידה לא נמצאה' });

  const currentSemester = await prisma.semester.findFirst({
    where: { institutionId: student.classRoom.grade.institutionId, endedAt: null },
  });
  if (!currentSemester) {
    return res.json({ months: [], studyDaysAccurate: false });
  }

  const semesterStart = currentSemester.startedAt.toISOString().slice(0, 10);
  const today = todayDateString();
  const semesterEnd = currentSemester.plannedEndDate ?? (today < semesterStart ? semesterStart : today);

  const monthBounds = new Map<number, { label: string; startISO: string; endISO: string }>();
  for (const iso of eachDate(semesterStart, semesterEnd)) {
    const { label, sortKey, startISO, endISO } = await toHebrewMonthKey(iso);
    if (!monthBounds.has(sortKey)) monthBounds.set(sortKey, { label, startISO, endISO });
  }

  const events = await prisma.attendanceEvent.findMany({
    where: { semesterId: currentSemester.id, studentId: student.id, type: { in: ['LATE', 'ABSENCE', 'RELEASE'] } },
  });
  const counts = new Map<number, { late: number; absence: number; release: number }>();
  for (const event of events) {
    const { sortKey } = await toHebrewMonthKey(event.date);
    if (!counts.has(sortKey)) counts.set(sortKey, { late: 0, absence: 0, release: 0 });
    const entry = counts.get(sortKey)!;
    if (event.type === 'LATE') entry.late += 1;
    else if (event.type === 'ABSENCE') entry.absence += 1;
    else entry.release += 1;
  }

  const overrides = await getOverridesMap(student.classRoom.grade.institutionId, semesterStart, semesterEnd);
  const sortedEntries = Array.from(monthBounds.entries()).sort(([a], [b]) => a - b);
  const months = sortedEntries.map(([sortKey, bounds]) => {
    // Full month, only clipped where the semester itself starts/ends mid-month.
    const clippedStart = bounds.startISO < semesterStart ? semesterStart : bounds.startISO;
    const clippedEnd = bounds.endISO > semesterEnd ? semesterEnd : bounds.endISO;
    const studyDays = countStudyDays(clippedStart, clippedEnd, currentSemester.yearLabel, overrides);
    const c = counts.get(sortKey) ?? { late: 0, absence: 0, release: 0 };
    return { label: bounds.label, studyDays, ...c };
  });

  res.json({
    months,
    studyDaysAccurate: overrides.size > 0 || hasCalendarData(currentSemester.yearLabel),
  });
}));

const createSchema = z.object({
  fullName: z.string().min(2),
  nationalId: z.string().min(1),
  classId: z.string().min(1),
});

router.post('/', requireRole('SYSTEM_ADMIN', 'SECRETARY'), asyncHandler(async (req, res) => {
  const institutionId = resolveInstitutionId(req);
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'פרטי תלמידה חסרים או שגויים' });

  const classRoom = await classInScope(parsed.data.classId, institutionId);
  if (!classRoom) return res.status(400).json({ error: 'כיתה לא נמצאה' });

  const student = await prisma.student.create({ data: parsed.data });
  res.status(201).json(student);
}));

const updateSchema = z.object({
  fullName: z.string().min(2).optional(),
  nationalId: z.string().min(1).optional(),
  classId: z.string().min(1).optional(),
});

router.patch('/:id', requireRole('SYSTEM_ADMIN', 'SECRETARY'), asyncHandler(async (req, res) => {
  const institutionId = resolveInstitutionId(req);
  const student = await studentInScope(req.params.id, institutionId);
  if (!student) return res.status(404).json({ error: 'תלמידה לא נמצאה' });

  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'פרטים לא תקינים' });

  if (parsed.data.classId) {
    const classRoom = await classInScope(parsed.data.classId, institutionId);
    if (!classRoom) return res.status(400).json({ error: 'כיתה לא נמצאה' });
  }

  const updated = await prisma.student.update({ where: { id: student.id }, data: parsed.data });
  res.json(updated);
}));

router.delete('/:id', requireRole('SYSTEM_ADMIN', 'SECRETARY'), asyncHandler(async (req, res) => {
  const institutionId = resolveInstitutionId(req);
  const student = await studentInScope(req.params.id, institutionId);
  if (!student) return res.status(404).json({ error: 'תלמידה לא נמצאה' });
  await prisma.attendanceEvent.deleteMany({ where: { studentId: student.id } });
  await prisma.student.delete({ where: { id: student.id } });
  res.status(204).send();
}));

router.post('/class/:classId/import', requireRole('SYSTEM_ADMIN', 'SECRETARY'), upload.single('file'), asyncHandler(async (req, res) => {
  const institutionId = resolveInstitutionId(req);
  const classRoom = await classInScope(req.params.classId, institutionId);
  if (!classRoom) return res.status(400).json({ error: 'כיתה לא נמצאה' });
  if (!req.file) return res.status(400).json({ error: 'לא צורף קובץ' });

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(req.file.buffer as unknown as ArrayBuffer);
  } catch {
    return res.status(400).json({ error: 'לא ניתן לקרוא את קובץ האקסל' });
  }
  const sheet = workbook.worksheets[0];
  if (!sheet) return res.status(400).json({ error: 'הקובץ ריק' });

  const nameKeys = ['שם', 'שם מלא', 'שם התלמידה', 'name', 'fullname'];
  const idKeys = ['ת.ז', 'ת.ז.', 'תעודת זהות', 'מספר זהות', 'id', 'nationalid'];

  const headerRow = sheet.getRow(1);
  let nameCol = -1;
  let idCol = -1;
  headerRow.eachCell((cell, colNumber) => {
    const value = String(cell.value ?? '').trim().toLowerCase();
    if (nameKeys.some((n) => value === n.toLowerCase())) nameCol = colNumber;
    if (idKeys.some((n) => value === n.toLowerCase())) idCol = colNumber;
  });

  const toCreate: { fullName: string; nationalId: string; classId: string }[] = [];
  if (nameCol !== -1) {
    for (let r = 2; r <= sheet.rowCount; r++) {
      const row = sheet.getRow(r);
      const fullName = String(row.getCell(nameCol).value ?? '').trim();
      const nationalId = idCol !== -1 ? String(row.getCell(idCol).value ?? '').trim() : '';
      if (fullName) {
        toCreate.push({ fullName, nationalId, classId: classRoom.id });
      }
    }
  }

  if (toCreate.length === 0) {
    return res.status(400).json({
      error: 'לא נמצאו שורות תקינות בקובץ. יש לוודא שיש עמודה עם כותרת "שם" ועמודה עם כותרת "ת.ז."',
    });
  }

  await prisma.student.createMany({ data: toCreate });
  res.status(201).json({ imported: toCreate.length });
}));

const lateSchema = z.object({ approved: z.boolean() });

router.post('/:id/late', requireRole('SYSTEM_ADMIN', 'SECRETARY'), asyncHandler(async (req, res) => {
  const institutionId = resolveInstitutionId(req);
  const student = await studentInScope(req.params.id, institutionId);
  if (!student) return res.status(404).json({ error: 'תלמידה לא נמצאה' });
  const parsed = lateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'יש לציין האם האיחור עם אישור או ללא אישור' });
  try {
    const result = await markLate(student.id, parsed.data.approved);
    res.json(result);
  } catch (err) {
    if (err instanceof NotFoundError) return res.status(404).json({ error: 'תלמידה לא נמצאה' });
    throw err;
  }
}));

router.post('/:id/absence', requireRole('SYSTEM_ADMIN', 'SECRETARY'), asyncHandler(async (req, res) => {
  const institutionId = resolveInstitutionId(req);
  const student = await studentInScope(req.params.id, institutionId);
  if (!student) return res.status(404).json({ error: 'תלמידה לא נמצאה' });
  const result = await markAbsence(student.id);
  res.json(result);
}));

router.post('/:id/release', requireRole('SYSTEM_ADMIN', 'SECRETARY'), asyncHandler(async (req, res) => {
  const institutionId = resolveInstitutionId(req);
  const student = await studentInScope(req.params.id, institutionId);
  if (!student) return res.status(404).json({ error: 'תלמידה לא נמצאה' });
  const result = await markRelease(student.id);
  res.status(200).json(result);
}));

router.post('/:id/submit-assignment', requireRole('SYSTEM_ADMIN', 'SECRETARY'), asyncHandler(async (req, res) => {
  const institutionId = resolveInstitutionId(req);
  const student = await studentInScope(req.params.id, institutionId);
  if (!student) return res.status(404).json({ error: 'תלמידה לא נמצאה' });
  const updated = await submitAssignment(student.id);
  res.json(updated);
}));

const removeEventsSchema = z.object({ eventIds: z.array(z.string().min(1)).min(1) });

router.post('/:id/events/remove', requireRole('SYSTEM_ADMIN', 'SECRETARY'), asyncHandler(async (req, res) => {
  const institutionId = resolveInstitutionId(req);
  const student = await studentInScope(req.params.id, institutionId);
  if (!student) return res.status(404).json({ error: 'תלמידה לא נמצאה' });

  const parsed = removeEventsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'יש לבחור לפחות אירוע אחד להסרה' });

  const result = await removeAttendanceEvents(student.id, parsed.data.eventIds);
  res.json(result);
}));

export default router;
