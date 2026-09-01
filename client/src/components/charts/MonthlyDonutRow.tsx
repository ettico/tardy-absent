export interface MonthlyRow {
  label: string;
  late: number;
  absence: number;
  release: number;
  studyDays: number;
}

const LATE_COLOR = '#d6a44a';
const ABSENCE_COLOR = '#c0525f';
const RELEASE_COLOR = '#0f8f82';
const CLEAN_COLOR = 'var(--bg)';

const SIZE = 88;
const STROKE = 14;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// One donut per Hebrew month of the semester: the WHOLE circle represents
// that month's real study-day count (not the student's own event total), so
// a single event out of ~20 study days reads as a thin sliver - only a
// month where a real share of the days were affected fills up visibly.
// Segments: late/absence/release each in their own color, the rest of the
// month's days as an unfilled/neutral remainder.
export default function MonthlyDonutRow({ months }: { months: MonthlyRow[] }) {
  if (months.length === 0) {
    return <p className="empty-note">אין עדיין נתונים להצגה במחצית הנוכחית.</p>;
  }

  return (
    <div>
      <div className="monthly-donut-row">
        {months.map((m) => {
          const total = m.studyDays;
          const segments = [
            { key: 'late', value: m.late, color: LATE_COLOR, label: 'איחורים' },
            { key: 'absence', value: m.absence, color: ABSENCE_COLOR, label: 'חיסורים' },
            { key: 'release', value: m.release, color: RELEASE_COLOR, label: 'שחרורים' },
          ];
          const affected = segments.reduce((sum, s) => sum + s.value, 0);
          const clean = Math.max(0, total - affected);

          let offsetSoFar = 0;
          return (
            <div key={m.label} className="monthly-donut-item">
              <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width={SIZE} height={SIZE} role="img" aria-label={`${m.label}: ${affected} מתוך ${total} ימי לימוד`}>
                <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" stroke={CLEAN_COLOR} strokeWidth={STROKE} />
                {total > 0 &&
                  segments
                    .filter((s) => s.value > 0)
                    .map((s) => {
                      const fraction = s.value / total;
                      const dash = fraction * CIRCUMFERENCE;
                      const gap = CIRCUMFERENCE - dash;
                      const circle = (
                        <circle
                          key={s.key}
                          cx={SIZE / 2}
                          cy={SIZE / 2}
                          r={RADIUS}
                          fill="none"
                          stroke={s.color}
                          strokeWidth={STROKE}
                          strokeDasharray={`${Math.max(0, dash - 1.5)} ${gap + 1.5}`}
                          strokeDashoffset={-offsetSoFar}
                          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
                        >
                          <title>{`${s.label} ב${m.label}: ${s.value} מתוך ${total} ימי לימוד`}</title>
                        </circle>
                      );
                      offsetSoFar += dash;
                      return circle;
                    })}
                <text x={SIZE / 2} y={SIZE / 2 + 4} textAnchor="middle" className="monthly-donut-count">
                  {affected || ''}
                </text>
              </svg>
              <div className="monthly-donut-label" title={`${m.label} - ${total} ימי לימוד`}>
                {m.label}
              </div>
            </div>
          );
        })}
      </div>
      <div className="chart-legend" style={{ justifyContent: 'center', marginTop: '0.75rem', marginBottom: 0 }}>
        <span className="chart-legend-item">
          <span className="chart-legend-key" style={{ background: LATE_COLOR }} />
          איחורים
        </span>
        <span className="chart-legend-item">
          <span className="chart-legend-key" style={{ background: ABSENCE_COLOR }} />
          חיסורים
        </span>
        <span className="chart-legend-item">
          <span className="chart-legend-key" style={{ background: RELEASE_COLOR }} />
          שחרורים
        </span>
        <span className="chart-legend-item">
          <span className="chart-legend-key" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }} />
          ללא אירוע
        </span>
      </div>
    </div>
  );
}
