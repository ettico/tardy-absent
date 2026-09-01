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

// Counts study days (Sunday-Thursday, inclusive of both ends) between two
// 'YYYY-MM-DD' dates. This is a weekday-pattern approximation only - it does
// not know about school holidays/vacations (there is no holiday calendar in
// this system), so it should be read as "school weeks", not an exact count.
export function countStudyDays(fromISO: string, toISO: string): number {
  const [fy, fm, fd] = fromISO.split('-').map(Number);
  const [ty, tm, td] = toISO.split('-').map(Number);
  const from = new Date(fy, fm - 1, fd);
  const to = new Date(ty, tm - 1, td);
  if (to < from) return 0;

  let count = 0;
  for (const d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
    const weekday = d.getDay(); // 0=Sunday, ..., 6=Saturday
    if (weekday >= 0 && weekday <= 4) count++;
  }
  return count;
}
