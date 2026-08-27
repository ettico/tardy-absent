import { useState } from 'react';
import { niceMax } from './niceMax';

export interface ChartSeries {
  key: string;
  label: string;
  color: string;
  values: number[];
}

interface TooltipState {
  x: number;
  y: number;
  category: string;
  seriesLabel: string;
  color: string;
  value: number;
}

const WIDTH = 640;
const HEIGHT = 280;
const PADDING_LEFT = 36;
const PADDING_BOTTOM = 28;
const PADDING_TOP = 10;
const PADDING_RIGHT = 6;
const MAX_BAR_WIDTH = 24;
const BAR_GAP = 2;

// Grouped column chart: one band per category, one bar per series inside the
// band. Built as plain SVG rather than a charting library, following the
// dataviz skill's mark specs (<=24px bars, 4px rounded data-end, 2px gaps,
// hairline gridlines, per-bar hover tooltip, legend for 2+ series).
export default function GroupedBarChart({
  categories,
  series,
  emptyLabel = 'אין נתונים להצגה',
}: {
  categories: string[];
  series: ChartSeries[];
  emptyLabel?: string;
}) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const allValues = series.flatMap((s) => s.values);
  const hasData = allValues.some((v) => v > 0);
  const maxValue = niceMax(Math.max(1, ...allValues));

  const plotWidth = WIDTH - PADDING_LEFT - PADDING_RIGHT;
  const plotHeight = HEIGHT - PADDING_TOP - PADDING_BOTTOM;
  const bandWidth = categories.length > 0 ? plotWidth / categories.length : plotWidth;
  const barWidth = Math.min(MAX_BAR_WIDTH, (bandWidth - BAR_GAP * (series.length + 1)) / Math.max(1, series.length));
  const groupWidth = barWidth * series.length + BAR_GAP * (series.length - 1);

  const yToPixel = (value: number) => PADDING_TOP + plotHeight * (1 - value / maxValue);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(maxValue * f));

  return (
    <div className="chart-wrap">
      {series.length > 1 && (
        <div className="chart-legend">
          {series.map((s) => (
            <span key={s.key} className="chart-legend-item">
              <span className="chart-legend-key" style={{ background: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
      )}
      {!hasData ? (
        <p className="empty-note" style={{ padding: '1.5rem 0' }}>
          {emptyLabel}
        </p>
      ) : (
        <div style={{ position: 'relative' }}>
          <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="chart-svg" role="img">
            {ticks.map((tick) => (
              <g key={tick}>
                <line
                  x1={PADDING_LEFT}
                  x2={WIDTH - PADDING_RIGHT}
                  y1={yToPixel(tick)}
                  y2={yToPixel(tick)}
                  className="chart-gridline"
                />
                <text x={PADDING_LEFT - 8} y={yToPixel(tick) + 4} className="chart-axis-label" textAnchor="end">
                  {tick.toLocaleString('he-IL')}
                </text>
              </g>
            ))}
            <line
              x1={PADDING_LEFT}
              x2={WIDTH - PADDING_RIGHT}
              y1={yToPixel(0)}
              y2={yToPixel(0)}
              className="chart-baseline"
            />

            {categories.map((category, ci) => {
              const bandStart = PADDING_LEFT + bandWidth * ci;
              const groupStart = bandStart + (bandWidth - groupWidth) / 2;
              return (
                <g key={category}>
                  <text
                    x={bandStart + bandWidth / 2}
                    y={HEIGHT - PADDING_BOTTOM + 18}
                    className="chart-axis-label"
                    textAnchor="middle"
                  >
                    {category}
                  </text>
                  {series.map((s, si) => {
                    const value = s.values[ci] ?? 0;
                    const barX = groupStart + si * (barWidth + BAR_GAP);
                    const barTop = yToPixel(value);
                    const barHeight = Math.max(0, yToPixel(0) - barTop);
                    const isHovered =
                      tooltip && tooltip.category === category && tooltip.seriesLabel === s.label;
                    return (
                      <rect
                        key={s.key}
                        x={barX}
                        y={barTop}
                        width={barWidth}
                        height={barHeight}
                        rx={4}
                        fill={s.color}
                        opacity={isHovered ? 0.8 : 1}
                        onMouseEnter={() =>
                          setTooltip({ x: barX + barWidth / 2, y: barTop, category, seriesLabel: s.label, color: s.color, value })
                        }
                        onMouseLeave={() => setTooltip(null)}
                        onFocus={() =>
                          setTooltip({ x: barX + barWidth / 2, y: barTop, category, seriesLabel: s.label, color: s.color, value })
                        }
                        onBlur={() => setTooltip(null)}
                        tabIndex={0}
                        style={{ cursor: 'pointer' }}
                      />
                    );
                  })}
                </g>
              );
            })}
          </svg>
          {tooltip && (
            <div
              className="chart-tooltip"
              style={{ left: `${(tooltip.x / WIDTH) * 100}%`, top: `${(tooltip.y / HEIGHT) * 100}%` }}
            >
              <div className="chart-tooltip-row">
                <span className="chart-tooltip-key" style={{ background: tooltip.color }} />
                <span className="chart-tooltip-value">{tooltip.value.toLocaleString('he-IL')}</span>
                <span className="chart-tooltip-label">{tooltip.seriesLabel}</span>
              </div>
              <div className="chart-tooltip-category">{tooltip.category}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
