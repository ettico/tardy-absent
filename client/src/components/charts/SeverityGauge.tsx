const SIZE = 160;
const STROKE = 20;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// Unlike DonutChart (which shows a student's own events split by category -
// always "100% full" of itself no matter how few events there are), this
// gauge fills relative to a fixed, external denominator: the number of study
// days in the semester. A student with 1 late out of 90 study days reads as
// mostly empty, as it should - the ring only fills up as the count climbs
// relative to the whole semester, which is what actually signals an outlier.
export default function SeverityGauge({
  label,
  count,
  studyDaysTotal,
  color,
}: {
  label: string;
  count: number;
  studyDaysTotal: number;
  color: string;
}) {
  const fraction = studyDaysTotal > 0 ? Math.min(count / studyDaysTotal, 1) : 0;
  const percent = studyDaysTotal > 0 ? Math.round((count / studyDaysTotal) * 100) : 0;
  const dash = fraction * CIRCUMFERENCE;
  const gap = CIRCUMFERENCE - dash;

  return (
    <div className="donut-wrap">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="donut-svg"
        role="img"
        aria-label={`${label}: ${count} מתוך ${studyDaysTotal} ימי לימוד`}
      >
        <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" stroke="var(--bg)" strokeWidth={STROKE} />
        {dash > 0 && (
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke={color}
            strokeWidth={STROKE}
            strokeDasharray={`${Math.max(0, dash - 2)} ${gap + 2}`}
            strokeLinecap="round"
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          >
            <title>{`${label}: ${count} מתוך ${studyDaysTotal} ימי לימוד (${percent}%)`}</title>
          </circle>
        )}
        <text x={SIZE / 2} y={SIZE / 2 - 4} textAnchor="middle" className="donut-center-value">
          {count}
        </text>
        <text x={SIZE / 2} y={SIZE / 2 + 16} textAnchor="middle" className="donut-center-label">
          מתוך {studyDaysTotal} ימי לימוד
        </text>
      </svg>
      <div className="chart-legend" style={{ marginTop: '0.5rem' }}>
        <span className="chart-legend-item">
          <span className="chart-legend-key" style={{ background: color }} />
          {label}: {percent}% מימי הלימוד
        </span>
      </div>
    </div>
  );
}
