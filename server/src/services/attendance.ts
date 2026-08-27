import { prisma } from '../prismaClient';
import { todayDateString, nowTimeString } from '../utils/dates';
import { sendEmail } from '../utils/email';
import { getOrCreateCurrentSemesterId } from './semester';

const ASSIGNMENT_THRESHOLD = 8;

export class NotFoundError extends Error {}

interface ActionResult {
  ok: boolean;
  message?: string;
  blocked?: boolean;
  justBlocked?: boolean;
}

async function getInstitutionIdForStudent(studentId: string): Promise<string> {
  const classRoom = await prisma.classRoom.findFirstOrThrow({
    where: { students: { some: { id: studentId } } },
    include: { grade: true },
  });
  return classRoom.grade.institutionId;
}

export async function markAbsence(studentId: string): Promise<ActionResult> {
  const student = await prisma.student.findUnique({ where: { id: studentId } });
  if (!student) throw new NotFoundError();
  const date = todayDateString();

  const existingLateToday = await prisma.attendanceEvent.findFirst({
    where: { studentId, type: 'LATE', date },
  });
  if (existingLateToday) {
    return {
      ok: false,
      message: `לא ניתן לסמן חיסור: התלמידה הגיעה היום באיחור (בשעה ${existingLateToday.time}), אין צורך לדווח עליה גם חיסור.`,
    };
  }

  const existingAbsenceToday = await prisma.attendanceEvent.findFirst({
    where: { studentId, type: 'ABSENCE', date },
  });
  if (existingAbsenceToday) {
    return { ok: false, message: 'החיסור כבר נרשם לתלמידה זו היום, אין צורך לרשום פעם נוספת.' };
  }

  const institutionId = await getInstitutionIdForStudent(studentId);
  await prisma.$transaction(async (tx) => {
    const semesterId = await getOrCreateCurrentSemesterId(tx, institutionId);
    await tx.attendanceEvent.create({ data: { studentId, type: 'ABSENCE', date, semesterId } });
    await tx.student.update({ where: { id: studentId }, data: { totalAbsenceCount: { increment: 1 } } });
  });
  return { ok: true, message: 'החיסור עודכן בהצלחה.' };
}

// Clicking "late" is a single, uniform action for the secretary - no
// disabled buttons, no confirmation steps. A student can only arrive late
// once per day though, so a second click today is rejected with a clear
// explanation rather than silently double-counting. The cycle counter
// (toward the 8-late assignment requirement) is never capped: it keeps
// climbing to 9, 10, 11... across separate days for as long as the
// assignment isn't submitted. `blocked` is a status flag only (drives the
// badge, the parent-letter option and the one principal email on the 9th) -
// it never prevents recording a late.
export async function markLate(studentId: string): Promise<ActionResult> {
  const student = await prisma.student.findUnique({ where: { id: studentId } });
  if (!student) throw new NotFoundError();

  const date = todayDateString();
  const time = nowTimeString();

  const existingLateToday = await prisma.attendanceEvent.findFirst({
    where: { studentId, type: 'LATE', date },
  });
  if (existingLateToday) {
    return {
      ok: false,
      message: `האיחור כבר נרשם לתלמידה זו היום (בשעה ${existingLateToday.time}), אין צורך לרשום פעם נוספת.`,
    };
  }

  const institutionId = await getInstitutionIdForStudent(studentId);
  let wasAbsenceConverted = false;

  const result = await prisma.$transaction(async (tx) => {
    const semesterId = await getOrCreateCurrentSemesterId(tx, institutionId);
    const existingAbsenceToday = await tx.attendanceEvent.findFirst({
      where: { studentId, type: 'ABSENCE', date },
    });
    if (existingAbsenceToday) {
      await tx.attendanceEvent.delete({ where: { id: existingAbsenceToday.id } });
      await tx.student.update({ where: { id: studentId }, data: { totalAbsenceCount: { decrement: 1 } } });
      wasAbsenceConverted = true;
    }

    const newCycleCount = student.cycleLateCount + 1;
    const updateData: Record<string, unknown> = {
      totalLateCount: { increment: 1 },
      cycleLateCount: newCycleCount,
    };
    const crossingIntoAssignment = newCycleCount === ASSIGNMENT_THRESHOLD;
    const crossingIntoBlocked = newCycleCount === ASSIGNMENT_THRESHOLD + 1;

    if (crossingIntoAssignment) {
      updateData.needsAssignment = true;
      updateData.assignmentsRequired = { increment: 1 };
    }
    if (newCycleCount > ASSIGNMENT_THRESHOLD) {
      updateData.blocked = true;
    }

    await tx.attendanceEvent.create({
      data: { studentId, type: 'LATE', date, time, overflow: newCycleCount > ASSIGNMENT_THRESHOLD, semesterId },
    });
    const updatedStudent = await tx.student.update({ where: { id: studentId }, data: updateData });
    return { updatedStudent, justBlocked: crossingIntoBlocked };
  });

  if (result.justBlocked) {
    await notifyPrincipalOfBlock(result.updatedStudent).catch((err) =>
      console.error('שגיאה בשליחת מייל למנהלת:', err)
    );
  }

  return {
    ok: true,
    blocked: result.updatedStudent.blocked,
    justBlocked: result.justBlocked,
    message: wasAbsenceConverted ? 'בוצע עדכון: החיסור הוחלף לאיחור.' : 'האיחור עודכן בהצלחה.',
  };
}

export async function markRelease(studentId: string): Promise<ActionResult> {
  const student = await prisma.student.findUnique({ where: { id: studentId } });
  if (!student) throw new NotFoundError();
  const date = todayDateString();
  const time = nowTimeString();
  const institutionId = await getInstitutionIdForStudent(studentId);

  await prisma.$transaction(async (tx) => {
    const semesterId = await getOrCreateCurrentSemesterId(tx, institutionId);
    await tx.attendanceEvent.create({ data: { studentId, type: 'RELEASE', date, time, semesterId } });
    await tx.student.update({ where: { id: studentId }, data: { totalReleaseCount: { increment: 1 } } });
  });
  return { ok: true, message: 'השחרור עודכן בהצלחה.' };
}

export async function submitAssignment(studentId: string) {
  const student = await prisma.student.findUnique({ where: { id: studentId } });
  if (!student) throw new NotFoundError();
  return prisma.student.update({
    where: { id: studentId },
    data: {
      cycleLateCount: 0,
      needsAssignment: false,
      blocked: false,
      assignmentsSubmitted: { increment: 1 },
    },
  });
}

async function notifyPrincipalOfBlock(student: { id: string; fullName: string; nationalId: string; classId: string; totalLateCount: number; totalAbsenceCount: number; assignmentsRequired: number; assignmentsSubmitted: number }) {
  const classRoom = await prisma.classRoom.findUnique({
    where: { id: student.classId },
    include: { grade: { include: { institution: true } } },
  });
  if (!classRoom) return;

  const principals = await prisma.user.findMany({
    where: { role: 'PRINCIPAL', institutionId: classRoom.grade.institutionId, email: { not: null } },
  });
  if (principals.length === 0) return;

  const assignmentsOwed = student.assignmentsRequired - student.assignmentsSubmitted;
  const body = [
    'שלום,',
    '',
    `לתלמידה ${student.fullName} (ת.ז. ${student.nationalId}) מכיתה ${classRoom.name} נשללה רשות הכניסה לכיתה עקב איחורים חוזרים.`,
    '',
    `סך איחורים במחצית: ${student.totalLateCount}`,
    `סך חיסורים במחצית: ${student.totalAbsenceCount}`,
    `עבודות שהתלמידה נדרשה להגיש וטרם הגישה: ${assignmentsOwed}`,
    '',
    'יש להפנות את הטיפול בתלמידה.',
  ].join('\n');

  for (const principal of principals) {
    if (principal.email) {
      await sendEmail({
        to: principal.email,
        subject: `התראה: שלילת כניסה לכיתה - ${student.fullName}`,
        body,
      });
    }
  }
}
