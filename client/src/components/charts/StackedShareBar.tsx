export interface ShareSegment {
  key: string;
  label: string;
  color: string;
  value: number;
}

// Part-to-whole composition as a single horizontal stacked bar - the
// dataviz skill's recommended form over a pie chart for a 2-4 category
// breakdown. Segments below a minimum width move their percentage to the
// legend instead of clipping an unreadable inline label.
export default function StackedShareBar({ segments }: { segments: ShareSegment[] }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);

  if (total === 0) {
    return <p className="empty-note">אין אירועים רשומים לתלמידה זו במחצית הנוכחית.</p>;
  }

  return (
    <div>
      <div className="share-bar" role="img" aria-label="פירוט איחורים, חיסורים ושחרורים">
        {segments
          .filter((s) => s.value > 0)
          .map((s) => {
            const pct = (s.value / total) * 100;
            return (
              <div
                key={s.key}
                className="share-bar-segment"
                style={{ width: `${pct}%`, background: s.color }}
                title={`${s.label}: ${s.value} (${pct.toFixed(0)}%)`}
              >
                {pct >= 12 && <span className="share-bar-inline-label">{pct.toFixed(0)}%</span>}
              </div>
            );
          })}
      </div>
      <div className="chart-legend" style={{ marginTop: '0.6rem' }}>
        {segments.map((s) => (
          <span key={s.key} className="chart-legend-item">
            <span className="chart-legend-key" style={{ background: s.color }} />
            {s.label}: {s.value} ({total > 0 ? ((s.value / total) * 100).toFixed(0) : 0}%)
          </span>
        ))}
      </div>
    </div>
  );
}
