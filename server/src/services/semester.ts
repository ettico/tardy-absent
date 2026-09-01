import type { Prisma } from '@prisma/client';
import { prisma } from '../prismaClient';

type Tx = Prisma.TransactionClient;

// Every institution should always have exactly one open (endedAt: null)
// semester. This self-heals institutions that predate the semester model.
export async function getOrCreateCurrentSemesterId(tx: Tx, institutionId: string): Promise<string> {
  const existing = await tx.semester.findFirst({ where: { institutionId, endedAt: null } });
  if (existing) return existing.id;

  const institution = await tx.institution.findUniqueOrThrow({ where: { id: institutionId } });
  const created = await tx.semester.create({
    data: { institutionId, yearLabel: institution.currentYearLabel ?? '', term: 1 },
  });
  return created.id;
}

async function resetStudentCounters(tx: Tx, institutionId: string) {
  // Only students in active (non-archived) classes get reset - a graduating
  // class's students are frozen forever at their final counts as the
  // historical record, not zeroed out.
  await tx.student.updateMany({
    where: { classRoom: { archived: false, grade: { institutionId } } },
    data: {
      totalLateCount: 0,
      totalAbsenceCount: 0,
      totalReleaseCount: 0,
      cycleLateCount: 0,
      needsAssignment: false,
      assignmentsRequired: 0,
      assignmentsSubmitted: 0,
      blocked: false,
    },
  });
}

export async function endSemester(institutionId: string, plannedEndDate?: string) {
  return prisma.$transaction(async (tx) => {
    const current = await tx.semester.findFirst({ where: { institutionId, endedAt: null } });
    const yearLabel = current?.yearLabel ?? (await tx.institution.findUniqueOrThrow({ where: { id: institutionId } })).currentYearLabel ?? '';
    const nextTerm = current?.term === 1 ? 2 : 1;

    if (current) {
      await tx.semester.update({ where: { id: current.id }, data: { endedAt: new Date() } });
    }
    const newSemester = await tx.semester.create({
      data: { institutionId, yearLabel, term: nextTerm, plannedEndDate: plannedEndDate || null },
    });
    await resetStudentCounters(tx, institutionId);
    return newSemester;
  });
}

// Updates the planned end date of the institution's currently open semester
// (e.g. set retroactively, or corrected mid-semester) - used to give the
// study-days-based severity indicators a fixed denominator.
export async function setCurrentSemesterPlannedEndDate(institutionId: string, plannedEndDate: string | null) {
  const current = await prisma.semester.findFirst({ where: { institutionId, endedAt: null } });
  if (!current) throw new Error('לא נמצאה מחצית פעילה למוסד זה');
  return prisma.semester.update({ where: { id: current.id }, data: { plannedEndDate } });
}

export async function yearRollover(institutionId: string, newYearLabel: string, plannedEndDate?: string) {
  return prisma.$transaction(async (tx) => {
    const grades = await tx.grade.findMany({
      where: { institutionId },
      orderBy: { order: 'asc' },
      include: { classes: { where: { archived: false } } },
    });
    if (grades.length < 2) {
      throw new Error('צריך לפחות שתי שכבות כדי לבצע מעבר שנה');
    }

    const institution = await tx.institution.findUniqueOrThrow({ where: { id: institutionId } });
    const oldYearLabel = institution.currentYearLabel ?? '';
    const topGrade = grades[grades.length - 1];

    // Graduate the top grade: freeze its classes+students, remove from active views.
    // The (gradeId, name, archived) unique constraint only frees up a name for
    // reuse once - the same top grade graduates a class with the same name
    // (e.g. "יב1") every single year, so without a year-scoped name the second
    // rollover would collide with last year's already-archived "יב1". Stamping
    // the year onto the archived name keeps every graduating class distinct.
    for (const cls of topGrade.classes) {
      const archivedName = oldYearLabel ? `${cls.name} (${oldYearLabel})` : cls.name;
      await tx.classRoom.update({
        where: { id: cls.id },
        data: { archived: true, archivedAt: new Date(), archivedYearLabel: oldYearLabel, name: archivedName },
      });
    }

    // Promote every other grade's classes up one level (based on the
    // pre-computed snapshot above, so reassignments never clash mid-loop).
    for (let i = grades.length - 2; i >= 0; i--) {
      const fromGrade = grades[i];
      const toGrade = grades[i + 1];
      for (const cls of fromGrade.classes) {
        const newName = cls.name.startsWith(fromGrade.name)
          ? toGrade.name + cls.name.slice(fromGrade.name.length)
          : cls.name;
        await tx.classRoom.update({ where: { id: cls.id }, data: { gradeId: toGrade.id, name: newName } });
      }
    }
    // The bottom grade now has zero active classes - ready for a new intake
    // via "add class" + Excel import, the same as first-time setup.

    const current = await tx.semester.findFirst({ where: { institutionId, endedAt: null } });
    if (current) {
      await tx.semester.update({ where: { id: current.id }, data: { endedAt: new Date() } });
    }
    await tx.semester.create({
      data: { institutionId, yearLabel: newYearLabel, term: 1, plannedEndDate: plannedEndDate || null },
    });
    await tx.institution.update({ where: { id: institutionId }, data: { currentYearLabel: newYearLabel } });
    await resetStudentCounters(tx, institutionId);

    return { promotedGrades: grades.length - 1, graduatedClasses: topGrade.classes.length };
  });
}
