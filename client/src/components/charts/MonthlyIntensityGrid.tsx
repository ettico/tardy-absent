export interface MonthlyRow {
  label: string;
  late: number;
  absence: number;
  release: number;
  studyDays: number;
}

// A month is "maximally saturated" (full red) once its rate reaches 1 event
// per 4 study days - everything below that scales linearly. This is a
// starting default, not a diagnosed threshold; adjust if it reads too
// sensitive or not sensitive enough in real use.
const REFERENCE_RATE = 0.25;

const LOW_COLOR = { r: 0xf7, g: 0xd9, b: 0xdc };
const HIGH_COLOR = { r: 0x7a, g: 0x1f, b: 0x2b };

function lerp(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

function cellStyle(count: number, studyDays: number): { background: string; color: string } {
  if (count === 0) return { background: 'var(--bg)', color: 'var(--text-muted)' };
  const rate = studyDays > 0 ? count / studyDays : 0;
  const fraction = Math.min(rate / REFERENCE_RATE, 1);
  const r = lerp(LOW_COLOR.r, HIGH_COLOR.r, fraction);
  const g = lerp(LOW_COLOR.g, HIGH_COLOR.g, fraction);
  const b = lerp(LOW_COLOR.b, HIGH_COLOR.b, fraction);
  return { background: `rgb(${r}, ${g}, ${b})`, color: fraction > 0.55 ? '#fff' : '#5c1620' };
}

const ROWS: { key: 'late' | 'absence' | 'release'; label: string }[] = [
  { key: 'late', label: 'איחורים' },
  { key: 'absence', label: 'חיסורים' },
  { key: 'release', label: 'שחרורים' },
];

// A month-by-type intensity grid: color reflects how many events happened
// relative to how many study days that month actually had (not raw counts),
// so the signal stays honest whether a month was long or holiday-shortened.
// The exact count is always printed in the cell too - color is a reinforcing
// signal, never the only way to read the value.
export default function MonthlyIntensityGrid({ months }: { months: MonthlyRow[] }) {
  if (months.length === 0) {
    return <p className="empty-note">אין עדיין נתונים להצגה במחצית הנוכחית.</p>;
  }

  return (
    <div className="intensity-grid-wrap">
      <table className="intensity-grid" role="table">
        <thead>
          <tr>
            <th></th>
            {months.map((m) => (
              <th key={m.label} title={`${m.label} - ${m.studyDays} ימי לימוד`}>
                {m.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row) => (
            <tr key={row.key}>
              <th scope="row">{row.label}</th>
              {months.map((m) => {
                const count = m[row.key];
                const style = cellStyle(count, m.studyDays);
                const rate = m.studyDays > 0 ? Math.round((count / m.studyDays) * 100) : 0;
                return (
                  <td key={m.label} style={{ background: style.background, color: style.color }}>
                    <span
                      title={`${row.label} ב${m.label}: ${count} מתוך ${m.studyDays} ימי לימוד (${rate}%)`}
                    >
                      {count}
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="intensity-legend">
        <span>נמוך</span>
        <span className="intensity-legend-bar" />
        <span>גבוה</span>
      </div>
    </div>
  );
}
