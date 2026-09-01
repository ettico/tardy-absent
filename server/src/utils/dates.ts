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

// Counts study days (Sunday-Thursday, excluding known school vacation days)
// between two 'YYYY-MM-DD' dates, inclusive of both ends. hebrewYearLabel
// (e.g. 'תשפ"ז') looks up real vacation dates in schoolCalendar.ts; with no
// entry for that year it falls back to a plain Sunday-Thursday count, which
// overcounts by not excluding that year's holidays - see schoolCalendar.ts.
export function countStudyDays(fromISO: string, toISO: string, hebrewYearLabel?: string | null): number {
  let count = 0;
  for (const iso of eachDate(fromISO, toISO)) {
    const [y, m, d] = iso.split('-').map(Number);
    const weekday = new Date(y, m - 1, d).getDay(); // 0=Sunday, ..., 6=Saturday
    if (weekday < 0 || weekday > 4) continue;
    if (isVacationDay(iso, hebrewYearLabel)) continue;
    count++;
  }
  return count;
}
