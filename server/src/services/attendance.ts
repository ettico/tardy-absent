import { prisma } from '../prismaClient';
import { todayDateString, nowTimeString } from '../utils/dates';
import { sendEmail } from '../utils/email';

const ASSIGNMENT_THRESHOLD = 8;

export class NotFoundError extends Error {}

interface ActionResult {
  ok: boolean;
  message?: string;
  blocked?: boolean;
  justBlocked?: boolean;
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
      message: `לא ניתן לסמן חיסור: לתלמידה כבר נרשם היום איחור בשעה ${existingLateToday.time}.`,
    };
  }

  const existingAbsenceToday = await prisma.attendanceEvent.findFirst({
    where: { studentId, type: 'ABSENCE', date },
  });
  if (existingAbsenceToday) {
    return { ok: false, message: 'כבר נרשם חיסור לתלמידה זו היום.' };
  }

  await prisma.$transaction([
    prisma.attendanceEvent.create({ data: { studentId, type: 'ABSENCE', date } }),
    prisma.student.update({ where: { id: studentId }, data: { totalAbsenceCount: { increment: 1 } } }),
  ]);
  return { ok: true };
}

export async function markLate(
  studentId: string,
  options: { overrideBlocked?: boolean } = {}
): Promise<ActionResult> {
  const student = await prisma.student.findUnique({ where: { id: studentId } });
  if (!student) throw new NotFoundError();

  if (student.blocked && !options.overrideBlocked) {
    return {
      ok: false,
      blocked: true,
      message: 'לתלמידה אין רשות כניסה לכיתה. יש להפנות אותה למנהלת בית הספר.',
    };
  }

  const date = todayDateString();
  const time = nowTimeString();

  const result = await prisma.$transaction(async (tx) => {
    const existingAbsenceToday = await tx.attendanceEvent.findFirst({
      where: { studentId, type: 'ABSENCE', date },
    });
    if (existingAbsenceToday) {
      await tx.attendanceEvent.delete({ where: { id: existingAbsenceToday.id } });
      await tx.student.update({ where: { id: studentId }, data: { totalAbsenceCount: { decrement: 1 } } });
    }

    const updateData: Record<string, unknown> = { totalLateCount: { increment: 1 } };
    let isOverflow = false;
    let justBlocked = false;

    if (student.blocked) {
      // Repeated late arrival while still blocked (10th, 11th... in this cycle).
      isOverflow = true;
    } else if (student.needsAssignment) {
      // This is the late that crosses back over the 8-late threshold -> blocked.
      updateData.blocked = true;
      isOverflow = true;
      justBlocked = true;
    } else {
      const newCycleCount = student.cycleLateCount + 1;
      updateData.cycleLateCount = newCycleCount;
      if (newCycleCount >= ASSIGNMENT_THRESHOLD) {
        updateData.needsAssignment = true;
        updateData.assignmentsRequired = { increment: 1 };
      }
    }

    await tx.attendanceEvent.create({
      data: { studentId, type: 'LATE', date, time, overflow: isOverflow },
    });
    const updatedStudent = await tx.student.update({ where: { id: studentId }, data: updateData });
    return { updatedStudent, justBlocked, isOverflow };
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
    message: result.isOverflow ? 'האיחור נרשם בסך הכל המחצית (התלמידה עדיין ללא רשות כניסה לכיתה).' : undefined,
  };
}

export async function markRelease(studentId: string): Promise<ActionResult> {
  const student = await prisma.student.findUnique({ where: { id: studentId } });
  if (!student) throw new NotFoundError();
  const date = todayDateString();
  const time = nowTimeString();

  await prisma.$transaction([
    prisma.attendanceEvent.create({ data: { studentId, type: 'RELEASE', date, time } }),
    prisma.student.update({ where: { id: studentId }, data: { totalReleaseCount: { increment: 1 } } }),
  ]);
  return { ok: true };
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
