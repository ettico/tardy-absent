import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, apiErrorMessage } from '../api/client';
import { useScopeParams } from '../hooks/useScope';
import Breadcrumbs from '../components/Breadcrumbs';

interface Period {
  periodNumber: number;
  startTime: string;
  endTime: string;
}

interface ClassDayRow {
  classId: string;
  className: string;
  gradeName: string;
  weekday: number;
  periodsCount: number | null;
}

type ScopeParams = { institutionId?: string };

const WEEKDAY_LABELS = ['יום א׳', 'יום ב׳', 'יום ג׳', 'יום ד׳', 'יום ה׳'];
const WEEKDAYS = [0, 1, 2, 3, 4];

export default function SchedulePage() {
  const scopeParams = useScopeParams();
  const [periods, setPeriods] = useState<Period[]>([]);
  const [classDays, setClassDays] = useState<ClassDayRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(null);

  function load() {
    setLoading(true);
    api
      .get<{ periods: Period[]; classDays: ClassDayRow[] }>('/schedule', { params: scopeParams })
      .then((res) => {
        setPeriods(res.data.periods);
        setClassDays(res.data.classDays);
      })
      .finally(() => setLoading(false));
  }

  useEffect(load, [scopeParams.institutionId]);

  function showToast(text: string, error = false) {
    setToast({ text, error });
    setTimeout(() => setToast(null), 3500);
  }

  if (loading && periods.length === 0 && classDays.length === 0) {
    return <p className="spinner-note">טוענת נתונים...</p>;
  }

  return (
    <div>
      <Breadcrumbs items={[{ label: 'סיום מחצית / מעבר שנה', to: '/school-year' }, { label: 'מערכת שעות' }]} />
      <div className="page-header">
        <h1>מערכת שעות ופעמונים</h1>
        <Link to="/school-year" className="btn btn-outline">
          חזרה
        </Link>
      </div>

      <p className="empty-note" style={{ marginBottom: '1.25rem' }}>
        הנתונים כאן משמשים לחישוב "חיסורי שעות" - כמה שיעורים החסירה תלמידה כשהיא הגיעה באיחור או השתחררה מוקדם. שינוי
        כאן משפיע רק על אירועים חדשים; אירועים קיימים שכבר חושבו לא ישתנו למפרע.
      </p>

      <PeriodsCard periods={periods} scopeParams={scopeParams} onSaved={load} showToast={showToast} />
      <ClassDaysGrid classDays={classDays} scopeParams={scopeParams} showToast={showToast} />

      {toast && <div className={`toast ${toast.error ? 'error' : ''}`}>{toast.text}</div>}
    </div>
  );
}

function PeriodsCard({
  periods,
  scopeParams,
  onSaved,
  showToast,
}: {
  periods: Period[];
  scopeParams: ScopeParams;
  onSaved: () => void;
  showToast: (text: string, error?: boolean) => void;
}) {
  const [rows, setRows] = useState<Period[]>(periods);
  const [saving, setSaving] = useState(false);

  useEffect(() => setRows(periods), [periods]);

  function updateRow(idx: number, field: keyof Period, value: string) {
    setRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, [field]: field === 'periodNumber' ? Number(value) : value } : r))
    );
  }

  function addRow() {
    const nextNumber = rows.length ? Math.max(...rows.map((r) => r.periodNumber)) + 1 : 1;
    setRows((prev) => [...prev, { periodNumber: nextNumber, startTime: '', endTime: '' }]);
  }

  function removeRow(idx: number) {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await api.put('/schedule/periods', { periods: rows, ...scopeParams });
      showToast('שעות הפעמונים נשמרו בהצלחה.');
      onSaved();
    } catch (err) {
      showToast(apiErrorMessage(err), true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
      <h2 style={{ marginTop: 0, fontSize: '1.05rem', color: 'var(--primary-dark)' }}>שעות פעמונים (משותף לכל הכיתות)</h2>
      <p className="empty-note">
        לכל שיעור יש להזין שעת התחלה ושעת סיום. הפער בין סיום שיעור אחד להתחלת הבא נחשב הפסקה אוטומטית - אין צורך
        להזין אותו בנפרד.
      </p>
      <div style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>שיעור</th>
              <th>שעת התחלה</th>
              <th>שעת סיום</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td>
                  <input
                    type="number"
                    min={1}
                    value={r.periodNumber}
                    onChange={(e) => updateRow(i, 'periodNumber', e.target.value)}
                    style={{ width: 60, textAlign: 'center' }}
                  />
                </td>
                <td>
                  <input type="time" value={r.startTime} onChange={(e) => updateRow(i, 'startTime', e.target.value)} />
                </td>
                <td>
                  <input type="time" value={r.endTime} onChange={(e) => updateRow(i, 'endTime', e.target.value)} />
                </td>
                <td>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeRow(i)}>
                    הסרה
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="empty-note">
                  טרם הוגדרו שיעורים.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="action-buttons" style={{ marginTop: '0.9rem' }}>
        <button type="button" className="btn btn-outline btn-sm" onClick={addRow}>
          + הוספת שיעור
        </button>
        <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'שומרת...' : 'שמירת שעות הפעמונים'}
        </button>
      </div>
    </div>
  );
}

function ClassDaysGrid({
  classDays,
  scopeParams,
  showToast,
}: {
  classDays: ClassDayRow[];
  scopeParams: ScopeParams;
  showToast: (text: string, error?: boolean) => void;
}) {
  const classesOrder = useMemo(() => {
    const seen = new Map<string, { classId: string; className: string; gradeName: string }>();
    for (const cd of classDays) {
      if (!seen.has(cd.classId)) seen.set(cd.classId, { classId: cd.classId, className: cd.className, gradeName: cd.gradeName });
    }
    return Array.from(seen.values());
  }, [classDays]);

  const cellMap = useMemo(() => {
    const m = new Map<string, number | null>();
    for (const cd of classDays) m.set(`${cd.classId}:${cd.weekday}`, cd.periodsCount);
    return m;
  }, [classDays]);

  const [localValues, setLocalValues] = useState<Map<string, string>>(new Map());

  function valueFor(classId: string, weekday: number) {
    const key = `${classId}:${weekday}`;
    if (localValues.has(key)) return localValues.get(key)!;
    const v = cellMap.get(key);
    return v === null || v === undefined ? '' : String(v);
  }

  async function saveCell(classId: string, weekday: number, value: string) {
    if (value === '') return;
    const periodsCount = Number(value);
    if (!Number.isInteger(periodsCount) || periodsCount < 0) return;
    try {
      await api.put('/schedule/class-day', { classId, weekday, periodsCount, ...scopeParams });
    } catch (err) {
      showToast(apiErrorMessage(err), true);
    }
  }

  return (
    <div className="card" style={{ padding: '1.25rem' }}>
      <h2 style={{ marginTop: 0, fontSize: '1.05rem', color: 'var(--primary-dark)' }}>מספר שיעורים ליום, לכל כיתה</h2>
      <p className="empty-note">
        לכל כיתה ולכל יום - עד איזה שיעור (מספר) היא לומדת באותו יום. עדכון תא בודד נשמר מיד עם היציאה ממנו; אין צורך
        למלא הכל מחדש כשמשהו משתנה.
      </p>
      <div style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>כיתה</th>
              {WEEKDAY_LABELS.map((w) => (
                <th key={w}>{w}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {classesOrder.map((c) => (
              <tr key={c.classId}>
                <td>
                  {c.className} <span className="stat-pill">{c.gradeName}</span>
                </td>
                {WEEKDAYS.map((weekday) => (
                  <td key={weekday}>
                    <input
                      type="number"
                      min={0}
                      max={20}
                      value={valueFor(c.classId, weekday)}
                      style={{ width: 56, textAlign: 'center' }}
                      onChange={(e) => {
                        const key = `${c.classId}:${weekday}`;
                        setLocalValues((prev) => new Map(prev).set(key, e.target.value));
                      }}
                      onBlur={(e) => saveCell(c.classId, weekday, e.target.value)}
                    />
                  </td>
                ))}
              </tr>
            ))}
            {classesOrder.length === 0 && (
              <tr>
                <td colSpan={WEEKDAYS.length + 1} className="empty-note">
                  אין כיתות פעילות במוסד זה.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
