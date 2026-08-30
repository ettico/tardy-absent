export interface DonutSegment {
  key: string;
  label: string;
  color: string;
  value: number;
}

const SIZE = 160;
const STROKE = 20;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// A student's status as a donut - reads correctly at any total (unlike a
// 100%-width stacked bar, which looks like "a lot" even when the total is
// just one event). The center callout carries the absolute count, since a
// ring alone only shows proportion.
export default function DonutChart({
  segments,
  centerLabel,
}: {
  segments: DonutSegment[];
  centerLabel: string;
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);

  if (total === 0) {
    return <p className="empty-note">אין אירועים רשומים לתלמידה זו במחצית הנוכחית.</p>;
  }

  let offsetSoFar = 0;

  return (
    <div className="donut-wrap">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="donut-svg" role="img" aria-label="פירוט איחורים, חיסורים ושחרורים">
        <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" stroke="var(--bg)" strokeWidth={STROKE} />
        {segments
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
                strokeDasharray={`${Math.max(0, dash - 2)} ${gap + 2}`}
                strokeDashoffset={-offsetSoFar}
                strokeLinecap="round"
                transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
              >
                <title>{`${s.label}: ${s.value} (${Math.round(fraction * 100)}%)`}</title>
              </circle>
            );
            offsetSoFar += dash;
            return circle;
          })}
        <text x={SIZE / 2} y={SIZE / 2 - 4} textAnchor="middle" className="donut-center-value">
          {total}
        </text>
        <text x={SIZE / 2} y={SIZE / 2 + 16} textAnchor="middle" className="donut-center-label">
          {centerLabel}
        </text>
      </svg>
      <div className="chart-legend" style={{ marginTop: '0.6rem' }}>
        {segments.map((s) => (
          <span key={s.key} className="chart-legend-item">
            <span className="chart-legend-key" style={{ background: s.color }} />
            {s.label}: {s.value} ({total > 0 ? Math.round((s.value / total) * 100) : 0}%)
          </span>
        ))}
      </div>
    </div>
  );
}
