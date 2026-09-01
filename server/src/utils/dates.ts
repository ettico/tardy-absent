import { isVacationDay } from '../data/schoolCalendar';

export function todayDateString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function nowTimeString(): string {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  return `${h}:${min}`;
}

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// All 'YYYY-MM-DD' dates from fromISO to toISO, inclusive.
export function eachDate(fromISO: string, toISO: string): string[] {
  const [fy, fm, fd] = fromISO.split('-').map(Number);
  const [ty, tm, td] = toISO.split('-').map(Number);
  const from = new Date(fy, fm - 1, fd);
  const to = new Date(ty, tm - 1, td);
  if (to < from) return [];

  const dates: string[] = [];
  for (const d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
    dates.push(toISODate(d));
  }
  return dates;
}

// Counts study days between two 'YYYY-MM-DD' dates, inclusive of both ends.
// Priority per day: an explicit entry in `overrides` (a per-institution
// upload or a manual calendar edit) always wins; failing that, a known
// vacation day for hebrewYearLabel (see schoolCalendar.ts) is excluded;
// failing that, Sunday-Thursday counts and Friday/Saturday don't. With no
// overrides and no calendar data for that year, this is a plain
// Sunday-Thursday count, which overcounts by not excluding real holidays.
export function countStudyDays(
  fromISO: string,
  toISO: string,
  hebrewYearLabel?: string | null,
  overrides?: Map<string, boolean>
): number {
  let count = 0;
  for (const iso of eachDate(fromISO, toISO)) {
    const override = overrides?.get(iso);
    if (override !== undefined) {
      if (override) count++;
      continue;
    }
    const [y, m, d] = iso.split('-').map(Number);
    const weekday = new Date(y, m - 1, d).getDay(); // 0=Sunday, ..., 6=Saturday
    if (weekday < 0 || weekday > 4) continue;
    if (isVacationDay(iso, hebrewYearLabel)) continue;
    count++;
  }
  return count;
}
