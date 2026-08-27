// @hebcal/core ships ESM-only, and this server runs as CommonJS, so it must
// be loaded via a genuine dynamic import() - but TypeScript with
// "module": "commonjs" silently downlevels `await import(...)` into
// `require(...)`, which then fails on this ESM-only package. The indirect
// `new Function` call below is opaque to that transform, forcing Node's real
// ESM loader. The loaded module is cached after the first call.
type HebcalModule = typeof import('@hebcal/core');
let hebcalModule: HebcalModule | null = null;
const dynamicImport = new Function('specifier', 'return import(specifier)') as (
  specifier: string
) => Promise<HebcalModule>;

async function getHebcal(): Promise<HebcalModule> {
  if (!hebcalModule) {
    hebcalModule = await dynamicImport('@hebcal/core');
  }
  return hebcalModule;
}

const WEEKDAYS_HE = ['יום ראשון', 'יום שני', 'יום שלישי', 'יום רביעי', 'יום חמישי', 'יום שישי', 'שבת'];

export interface HebrewMonthKey {
  label: string; // e.g. "אלול תשפ״ו"
  sortKey: number; // absolute day count of the 1st of the month, for chronological ordering
}

// isoDate is 'YYYY-MM-DD'. Groups a date into its Hebrew month, for by-month
// aggregation (e.g. the management dashboard's monthly trend chart).
export async function toHebrewMonthKey(isoDate: string): Promise<HebrewMonthKey> {
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const { HDate, Locale, gematriya } = await getHebcal();
  const hd = new HDate(date);
  const monthName = Locale.hebrewStripNikkud(Locale.gettext(hd.getMonthName(), 'he'));
  const yearLabel = gematriya(hd.getFullYear());
  const firstOfMonth = new HDate(1, hd.getMonth(), hd.getFullYear());
  return { label: `${monthName} ${yearLabel}`, sortKey: firstOfMonth.abs() };
}

// isoDate is 'YYYY-MM-DD'. Parsed as local calendar date (not UTC) to avoid
// off-by-one-day shifts around midnight in different timezones.
export async function toHebrewDateString(isoDate: string): Promise<string> {
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const { HDate } = await getHebcal();
  const hd = new HDate(date);
  return `${WEEKDAYS_HE[date.getDay()]}, ${hd.renderGematriya(true)}`;
}
