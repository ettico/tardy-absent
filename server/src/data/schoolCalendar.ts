// Israeli high-school (חטיבה עליונה/תיכון) vacation calendar, by Hebrew year
// label (e.g. 'תשפ"ז'). Used to make study-day counts exclude real school
// holidays, not just Saturdays.
//
// Sourcing: the fixed Jewish-holiday dates (Rosh Hashana, Yom Kippur, Sukkot,
// Purim, Pesach, Shavuot) were cross-checked against @hebcal/core (which is
// authoritative for those - they are calendrical facts, not policy). The
// administrative vacation *ranges* around them (how many extra days a school
// closes for) come from the Israeli Ministry of Education's published
// תשפ"ז circular for high schools ("לוח שנת הלימודים תשפ"ז בחטיבות
// העליונות"), found via web search - the ministry's own site
// (apps.education.gov.il / parents.education.gov.il) could not be fetched
// directly from this environment (network egress is blocked), so these were
// taken from news aggregators citing that circular and validated internally
// for date consistency wherever possible. Spot-check against your own
// school's official calendar before relying on this for anything formal.
//
// This table only covers תשפ"ז (school year 2026-2027). A different/future
// year with no entry here falls back to counting Sunday-Thursday only (see
// countStudyDays), which will overcount study days by not excluding that
// year's holidays - add a new entry here (and get it verified) when needed.
export interface VacationRange {
  start: string; // 'YYYY-MM-DD', inclusive
  end: string; // 'YYYY-MM-DD', inclusive
  label: string;
}

export const SCHOOL_CALENDARS: Record<string, { highSchoolYearEnd: string; vacations: VacationRange[] }> = {
  'תשפ"ז': {
    // Last official day of the 2026-2027 school year for high schools
    // (elementary/kindergarten end later, mid/high schools end here).
    highSchoolYearEnd: '2027-06-20',
    vacations: [
      { start: '2026-09-11', end: '2026-09-13', label: 'ראש השנה' },
      { start: '2026-09-20', end: '2026-09-21', label: 'יום כיפור' },
      { start: '2026-09-25', end: '2026-10-03', label: 'סוכות' },
      { start: '2026-12-06', end: '2026-12-12', label: 'חנוכה' },
      { start: '2027-03-23', end: '2027-03-24', label: 'פורים' },
      { start: '2027-04-13', end: '2027-04-28', label: 'פסח' },
      { start: '2027-06-10', end: '2027-06-11', label: 'שבועות' },
    ],
  },
};

// Year labels are free text (typed by an admin, or generated via gematriya()
// elsewhere), so "תשפ"ז" may show up with a straight quote, the Hebrew
// gershayim (״), or none at all. Compare only the Hebrew letters themselves
// so any of those spellings match the same calendar entry.
function normalizeHebrewYear(label: string): string {
  return label.replace(/[^א-ת]/g, '');
}

const NORMALIZED_CALENDARS = new Map(
  Object.entries(SCHOOL_CALENDARS).map(([label, calendar]) => [normalizeHebrewYear(label), calendar])
);

export function hasCalendarData(hebrewYearLabel: string | null | undefined): boolean {
  return !!hebrewYearLabel && NORMALIZED_CALENDARS.has(normalizeHebrewYear(hebrewYearLabel));
}

export function isVacationDay(isoDate: string, hebrewYearLabel: string | null | undefined): boolean {
  if (!hebrewYearLabel) return false;
  const calendar = NORMALIZED_CALENDARS.get(normalizeHebrewYear(hebrewYearLabel));
  if (!calendar) return false;
  return calendar.vacations.some((v) => isoDate >= v.start && isoDate <= v.end);
}
