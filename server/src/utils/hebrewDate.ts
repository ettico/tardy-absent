// @hebcal/core ships ESM-only, and this server runs as CommonJS, so it must
// be loaded via dynamic import(); the loaded module is cached after the
// first call.
type HebcalModule = typeof import('@hebcal/core');
let hebcalModule: HebcalModule | null = null;

async function getHebcal(): Promise<HebcalModule> {
  if (!hebcalModule) {
    hebcalModule = await import('@hebcal/core');
  }
  return hebcalModule;
}

const WEEKDAYS_HE = ['יום ראשון', 'יום שני', 'יום שלישי', 'יום רביעי', 'יום חמישי', 'יום שישי', 'שבת'];

// isoDate is 'YYYY-MM-DD'. Parsed as local calendar date (not UTC) to avoid
// off-by-one-day shifts around midnight in different timezones.
export async function toHebrewDateString(isoDate: string): Promise<string> {
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const { HDate } = await getHebcal();
  const hd = new HDate(date);
  return `${WEEKDAYS_HE[date.getDay()]}, ${hd.renderGematriya(true)}`;
}
