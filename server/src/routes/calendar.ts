import { Router } from 'express';
import multer from 'multer';
import ExcelJS from 'exceljs';
import { z } from 'zod';
import { prisma } from '../prismaClient';
import { requireAuth, requireRole, resolveInstitutionId } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { eachDate } from '../utils/dates';
import { isVacationDay } from '../data/schoolCalendar';

const router = Router();
router.use(requireAuth, requireRole('SYSTEM_ADMIN', 'SECRETARY', 'PRINCIPAL'));
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'תאריך לא תקין');

// The fully-resolved study/non-study status for every day in a range - the
// calendar page renders straight from this, one call per screen, instead of
// re-deriving the weekday/holiday/override logic itself. Query params
// `from`/`to` are required, both 'YYYY-MM-DD'.
router.get('/resolved', asyncHandler(async (req, res) => {
  const institutionId = resolveInstitutionId(req);
  if (!institutionId) return res.status(400).json({ error: 'לא נבחר מוסד' });
  const from = dateSchema.safeParse(req.query.from);
  const to = dateSchema.safeParse(req.query.to);
  if (!from.success || !to.success) return res.status(400).json({ error: 'יש לציין טווח תאריכים תקין' });

  const semester = await prisma.semester.findFirst({ where: { institutionId, endedAt: null } });
  const overrides = await prisma.calendarOverride.findMany({
    where: { institutionId, date: { gte: from.data, lte: to.data } },
  });
  const overrideMap = new Map(overrides.map((o) => [o.date, o]));

  const days = eachDate(from.data, to.data).map((date) => {
    const override = overrideMap.get(date);
    if (override) {
      return { date, isStudyDay: override.isStudyDay, overridden: true, label: override.label };
    }
    const [y, m, d] = date.split('-').map(Number);
    const weekday = new Date(y, m - 1, d).getDay();
    const isStudyDay = weekday >= 0 && weekday <= 4 && !isVacationDay(date, semester?.yearLabel);
    return { date, isStudyDay, overridden: false, label: null };
  });

  res.json(days);
}));

const setDaySchema = z.object({ isStudyDay: z.boolean(), label: z.string().max(200).optional() });

// Sets (or replaces) a single day's override - used by the calendar page's
// click-to-edit, e.g. an unplanned emergency closure.
router.put('/:date', asyncHandler(async (req, res) => {
  const institutionId = resolveInstitutionId(req);
  if (!institutionId) return res.status(400).json({ error: 'לא נבחר מוסד' });
  const dateParsed = dateSchema.safeParse(req.params.date);
  if (!dateParsed.success) return res.status(400).json({ error: 'תאריך לא תקין' });
  const bodyParsed = setDaySchema.safeParse(req.body);
  if (!bodyParsed.success) return res.status(400).json({ error: 'נתונים לא תקינים' });

  const override = await prisma.calendarOverride.upsert({
    where: { institutionId_date: { institutionId, date: dateParsed.data } },
    create: { institutionId, date: dateParsed.data, isStudyDay: bodyParsed.data.isStudyDay, label: bodyParsed.data.label || null },
    update: { isStudyDay: bodyParsed.data.isStudyDay, label: bodyParsed.data.label || null },
  });
  res.json(override);
}));

// Reverts a single day back to the default calculation (removes its override).
router.delete('/:date', asyncHandler(async (req, res) => {
  const institutionId = resolveInstitutionId(req);
  if (!institutionId) return res.status(400).json({ error: 'לא נבחר מוסד' });
  const dateParsed = dateSchema.safeParse(req.params.date);
  if (!dateParsed.success) return res.status(400).json({ error: 'תאריך לא תקין' });

  await prisma.calendarOverride.deleteMany({ where: { institutionId, date: dateParsed.data } });
  res.status(204).send();
}));

const STUDY_YES = ['כן', 'yes', 'true', '1'];
const STUDY_NO = ['לא', 'no', 'false', '0'];

function cellToISODate(value: unknown): string | null {
  if (value instanceof Date) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  }
  const str = String(value ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  // Also accept DD/MM/YYYY, a common Excel display format.
  const m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return null;
}

// Uploads an Excel file with columns "תאריך" (date) and "יום לימודים"
// (כן/לא) and stores one CalendarOverride row per data row - see
// server/scripts or the template downloaded from the school-year page for
// the exact expected format. Every date the file lists becomes an explicit
// override for that institution, replacing any previous value for that date.
router.post('/upload', upload.single('file'), asyncHandler(async (req, res) => {
  const institutionId = resolveInstitutionId(req);
  if (!institutionId) return res.status(400).json({ error: 'לא נבחר מוסד' });
  if (!req.file) return res.status(400).json({ error: 'לא צורף קובץ' });

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(req.file.buffer as unknown as ArrayBuffer);
  } catch {
    return res.status(400).json({ error: 'לא ניתן לקרוא את קובץ האקסל' });
  }
  const sheet = workbook.worksheets[0];
  if (!sheet) return res.status(400).json({ error: 'הקובץ ריק' });

  const dateKeys = ['תאריך', 'date'];
  const studyKeys = ['יום לימודים', 'יום לימוד', 'studyday'];

  // The header row isn't assumed to be row 1 - a real file (including the
  // template this app generates) may have a title/instructions above the
  // table, so scan the first 20 rows for the one containing both headers.
  let headerRowNum = -1;
  let dateCol = -1;
  let studyCol = -1;
  for (let r = 1; r <= Math.min(20, sheet.rowCount); r++) {
    let foundDateCol = -1;
    let foundStudyCol = -1;
    sheet.getRow(r).eachCell((cell, colNumber) => {
      const value = String(cell.value ?? '').trim().toLowerCase();
      if (dateKeys.some((k) => value === k.toLowerCase())) foundDateCol = colNumber;
      if (studyKeys.some((k) => value === k.toLowerCase())) foundStudyCol = colNumber;
    });
    if (foundDateCol !== -1 && foundStudyCol !== -1) {
      headerRowNum = r;
      dateCol = foundDateCol;
      studyCol = foundStudyCol;
      break;
    }
  }
  if (headerRowNum === -1) {
    return res.status(400).json({
      error: 'לא נמצאו העמודות הנדרשות. יש לוודא שיש עמודה בשם "תאריך" ועמודה בשם "יום לימודים" (כן/לא)',
    });
  }

  const overrides: { date: string; isStudyDay: boolean }[] = [];
  let skipped = 0;
  for (let r = headerRowNum + 1; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const iso = cellToISODate(row.getCell(dateCol).value);
    const studyRaw = String(row.getCell(studyCol).value ?? '').trim().toLowerCase();
    if (!iso) continue;
    if (STUDY_YES.includes(studyRaw)) overrides.push({ date: iso, isStudyDay: true });
    else if (STUDY_NO.includes(studyRaw)) overrides.push({ date: iso, isStudyDay: false });
    else skipped++;
  }

  if (overrides.length === 0) {
    return res.status(400).json({ error: 'לא נמצאו שורות תקינות בקובץ' });
  }

  await prisma.$transaction(
    overrides.map((o) =>
      prisma.calendarOverride.upsert({
        where: { institutionId_date: { institutionId, date: o.date } },
        create: { institutionId, date: o.date, isStudyDay: o.isStudyDay },
        update: { isStudyDay: o.isStudyDay },
      })
    )
  );

  res.status(201).json({ imported: overrides.length, skipped });
}));

export default router;
