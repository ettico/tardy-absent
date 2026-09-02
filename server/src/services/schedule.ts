import { prisma } from '../prismaClient';

export interface Period {
  periodNumber: number;
  startTime: string; // 'HH:mm'
  endTime: string; // 'HH:mm'
}

export function weekdayOf(dateISO: string): number {
  const [y, m, d] = dateISO.split('-').map(Number);
  return new Date(y, m - 1, d).getDay(); // 0=Sunday .. 6=Saturday
}

export async function getInstitutionPeriods(institutionId: string): Promise<Period[]> {
  const rows = await prisma.schedulePeriod.findMany({
    where: { institutionId },
    orderBy: { periodNumber: 'asc' },
  });
  return rows.map((r) => ({ periodNumber: r.periodNumber, startTime: r.startTime, endTime: r.endTime }));
}

export async function getClassDayPeriodsCount(classId: string, weekday: number): Promise<number | null> {
  const row = await prisma.classDaySchedule.findUnique({ where: { classId_weekday: { classId, weekday } } });
  return row ? row.periodsCount : null;
}

// Periods missed count only full lesson periods, never breaks between them.
// For a LATE arrival, a period counts as missed once it has fully ended
// before the arrival time; for a RELEASE, a period counts as missed once it
// starts at or after the release time. Either way, the single period during
// which the student actually walks in/out is not counted as missed - she's
// credited with having been present for at least part of it.
export function computePeriodsMissed(
  periods: Period[],
  periodsCountThatDay: number,
  time: string,
  mode: 'late' | 'release'
): number {
  const dayPeriods = periods.filter((p) => p.periodNumber <= periodsCountThatDay);
  if (mode === 'late') return dayPeriods.filter((p) => p.endTime <= time).length;
  return dayPeriods.filter((p) => p.startTime >= time).length;
}

// Resolves and computes periodsMissed for one LATE/RELEASE event at the
// moment it's recorded - null if the institution hasn't set up its bell
// schedule yet, or this specific class/weekday combination isn't configured.
// The result is meant to be stored on the event (a permanent snapshot), not
// recomputed later - see AttendanceEvent.periodsMissed.
export async function resolvePeriodsMissed(
  institutionId: string,
  classId: string,
  dateISO: string,
  time: string,
  mode: 'late' | 'release'
): Promise<number | null> {
  const periodsCount = await getClassDayPeriodsCount(classId, weekdayOf(dateISO));
  if (periodsCount === null) return null;
  const periods = await getInstitutionPeriods(institutionId);
  if (periods.length === 0) return null;
  return computePeriodsMissed(periods, periodsCount, time, mode);
}
