import { HDate } from '@hebcal/core';

const WEEKDAYS_HE = ['יום ראשון', 'יום שני', 'יום שלישי', 'יום רביעי', 'יום חמישי', 'יום שישי', 'שבת'];

// isoDate is 'YYYY-MM-DD'. Parsed as local calendar date (not UTC) to avoid
// off-by-one-day shifts around midnight in different timezones.
export function toHebrewDateString(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const hd = new HDate(date);
  return `${WEEKDAYS_HE[date.getDay()]}, ${hd.renderGematriya(true)}`;
}

export function todayHebrewDateString(): string {
  const now = new Date();
  return toHebrewDateString(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`);
}
