import { prisma } from '../prismaClient';
import { countStudyDays } from '../utils/dates';

// Loads this institution's explicit calendar overrides in a date range as a
// lookup map, for feeding into countStudyDays. Only exceptions are stored,
// so this is typically a short list even across a full year.
export async function getOverridesMap(
  institutionId: string,
  fromISO: string,
  toISO: string
): Promise<Map<string, boolean>> {
  const rows = await prisma.calendarOverride.findMany({
    where: { institutionId, date: { gte: fromISO, lte: toISO } },
  });
  return new Map(rows.map((r) => [r.date, r.isStudyDay]));
}

// Institution-aware study-day count: applies this institution's own
// calendar overrides (from an uploaded file or manual calendar edits) on
// top of the Sunday-Thursday + schoolCalendar.ts defaults.
export async function countInstitutionStudyDays(
  institutionId: string,
  fromISO: string,
  toISO: string,
  hebrewYearLabel?: string | null
): Promise<number> {
  const overrides = await getOverridesMap(institutionId, fromISO, toISO);
  return countStudyDays(fromISO, toISO, hebrewYearLabel, overrides);
}
