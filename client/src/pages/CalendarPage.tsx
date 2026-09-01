import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, apiErrorMessage } from '../api/client';
import { useScopeParams } from '../hooks/useScope';
import Breadcrumbs from '../components/Breadcrumbs';

interface ResolvedDay {
  date: string;
  isStudyDay: boolean;
  overridden: boolean;
  label: string | null;
}

const WEEKDAY_HEADERS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
const MONTH_NAMES = [
  'ינואר',
  'פברואר',
  'מרץ',
  'אפריל',
  'מאי',
  'יוני',
  'יולי',
  'אוגוסט',
  'ספטמבר',
  'אוקטובר',
  'נובמבר',
  'דצמבר',
];

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function CalendarPage() {
  const scopeParams = useScopeParams();
  const [cursor, setCursor] = useState(() => new Date());
  const [days, setDays] = useState<Map<string, ResolvedDay>>(new Map());
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const year = cursor.getFullYear();
  const month = cursor.getMonth(); // 0-11

  function load() {
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0);
    // Pad to full weeks (Sunday-Saturday) so the grid always has whole rows.
    const gridStart = new Date(monthStart);
    gridStart.setDate(gridStart.getDate() - gridStart.getDay());
    const gridEnd = new Date(monthEnd);
    gridEnd.setDate(gridEnd.getDate() + (6 - gridEnd.getDay()));

    setLoading(true);
    api
      .get<ResolvedDay[]>('/calendar/resolved', {
        params: { ...scopeParams, from: toISODate(gridStart), to: toISODate(gridEnd) },
      })
      .then((res) => setDays(new Map(res.data.map((d) => [d.date, d]))))
      .finally(() => setLoading(false));
  }

  useEffect(load, [year, month, scopeParams.institutionId]);

  function showToast(text: string, error = false) {
    setToast({ text, error });
    setTimeout(() => setToast(null), 3500);
  }

  async function handleDayClick(day: ResolvedDay) {
    const nextValue = !day.isStudyDay;
    const actionLabel = nextValue ? 'יום לימודים' : 'חופשה / לא יום לימודים';
    if (!confirm(`לסמן את ${day.date} כ"${actionLabel}"?`)) return;
    try {
      await api.put(`/calendar/${day.date}`, { isStudyDay: nextValue, ...scopeParams });
      load();
    } catch (err) {
      showToast(apiErrorMessage(err), true);
    }
  }

  async function handleUpload() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const params = new URLSearchParams(scopeParams as Record<string, string>).toString();
      const res = await api.post(`/calendar/upload?${params}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      showToast(`עודכנו ${res.data.imported} ימים בהצלחה.`);
      if (fileRef.current) fileRef.current.value = '';
      load();
    } catch (err) {
      showToast(apiErrorMessage(err), true);
    } finally {
      setUploading(false);
    }
  }

  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0);
  const gridStartDay = new Date(monthStart);
  gridStartDay.setDate(gridStartDay.getDate() - gridStartDay.getDay());
  const gridEndDay = new Date(monthEnd);
  gridEndDay.setDate(gridEndDay.getDate() + (6 - gridEndDay.getDay()));
  const cells: Date[] = [];
  for (const d = new Date(gridStartDay); d <= gridEndDay; d.setDate(d.getDate() + 1)) {
    cells.push(new Date(d));
  }

  return (
    <div>
      <Breadcrumbs items={[{ label: 'סיום מחצית / מעבר שנה', to: '/school-year' }, { label: 'לוח ימי לימוד' }]} />
      <div className="page-header">
        <h1>לוח ימי לימוד</h1>
        <Link to="/school-year" className="btn btn-outline">
          חזרה
        </Link>
      </div>

      <div className="card" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
        <p className="empty-note">
          לחיצה על יום בודד תהפוך אותו בין "יום לימודים" ל"חופשה" - שימושי לעדכון חד-פעמי (למשל חופשה בלתי צפויה).
          לעדכון גדול (כמו קובץ שלם לשנה), עדיף להעלות קובץ אקסל.
        </p>
        <div className="action-buttons" style={{ alignItems: 'flex-end' }}>
          <div className="form-field" style={{ marginBottom: 0 }}>
            <label>עדכון מקובץ אקסל (עמודות "תאריך" ו"יום לימודים")</label>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" />
          </div>
          <button className="btn btn-primary" onClick={handleUpload} disabled={uploading}>
            {uploading ? 'מעלה...' : 'העלאה'}
          </button>
        </div>
      </div>

      <div className="page-header">
        <div className="action-buttons">
          <button className="btn btn-outline btn-sm" onClick={() => setCursor(new Date(year, month - 1, 1))}>
            ← חודש קודם
          </button>
          <button className="btn btn-outline btn-sm" onClick={() => setCursor(new Date(year, month + 1, 1))}>
            חודש הבא →
          </button>
        </div>
        <h2 style={{ margin: 0 }}>
          {MONTH_NAMES[month]} {year}
        </h2>
      </div>

      {loading ? (
        <p className="spinner-note">טוענת...</p>
      ) : (
        <div className="calendar-grid">
          {WEEKDAY_HEADERS.map((h) => (
            <div key={h} className="calendar-grid-header">
              {h}
            </div>
          ))}
          {cells.map((cellDate) => {
            const iso = toISODate(cellDate);
            const day = days.get(iso);
            const inMonth = cellDate.getMonth() === month;
            const classNames = ['calendar-day'];
            if (!inMonth) classNames.push('calendar-day-outside');
            if (day) classNames.push(day.isStudyDay ? 'calendar-day-study' : 'calendar-day-off');
            if (day?.overridden) classNames.push('calendar-day-overridden');
            return (
              <button
                key={iso}
                type="button"
                className={classNames.join(' ')}
                title={day ? (day.isStudyDay ? 'יום לימודים - לחצי לשינוי' : 'חופשה - לחצי לשינוי') : ''}
                onClick={() => day && handleDayClick(day)}
              >
                {cellDate.getDate()}
              </button>
            );
          })}
        </div>
      )}

      <div className="chart-legend" style={{ justifyContent: 'center', marginTop: '1rem' }}>
        <span className="chart-legend-item">
          <span className="chart-legend-key" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }} />
          יום לימודים
        </span>
        <span className="chart-legend-item">
          <span className="chart-legend-key" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }} />
          חופשה
        </span>
        <span className="chart-legend-item">
          <span className="chart-legend-key" style={{ border: '2px solid var(--primary)' }} />
          שונה ידנית
        </span>
      </div>

      {toast && <div className={`toast ${toast.error ? 'error' : ''}`}>{toast.text}</div>}
    </div>
  );
}
