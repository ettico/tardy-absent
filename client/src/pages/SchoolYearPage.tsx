import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api, apiErrorMessage } from '../api/client';
import { useScopeParams } from '../hooks/useScope';
import Modal from '../components/Modal';
import type { Institution } from '../types';

export default function SchoolYearPage() {
  const scopeParams = useScopeParams();
  const [showEndSemester, setShowEndSemester] = useState(false);
  const [showRollover, setShowRollover] = useState(false);
  const [institution, setInstitution] = useState<Institution | null>(null);

  function loadInstitution() {
    api.get<Institution>('/institutions/current', { params: scopeParams }).then((res) => setInstitution(res.data));
  }

  useEffect(loadInstitution, [scopeParams.institutionId]);

  return (
    <div>
      <div className="page-header">
        <h1>ניהול מחצית ושנת לימודים</h1>
        <Link to="/archive" className="btn btn-outline">
          מעבר לארכיון
        </Link>
      </div>

      <div className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
        <p>
          <b>מוסד:</b> {institution?.name ?? '-'}
        </p>
        <p>
          <b>שנת לימודים נוכחית:</b> {institution?.currentYearLabel || 'טרם הוגדרה (תוגדר בביצוע מעבר שנה ראשון)'}
        </p>
      </div>

      <PlannedEndDateCard institution={institution} scopeParams={scopeParams} onUpdated={loadInstitution} />

      <div className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
        <h2 style={{ marginTop: 0, fontSize: '1.05rem', color: 'var(--primary-dark)' }}>מערכת שעות ופעמונים</h2>
        <p className="empty-note">
          הגדרת שעות הפעמונים ומספר השיעורים ליום לכל כיתה - נדרש כדי שהמערכת תוכל לחשב "חיסורי שעות" לתלמידה
          שהגיעה באיחור או השתחררה מוקדם.
        </p>
        <Link to="/school-year/schedule" className="btn btn-outline">
          פתיחת מערכת שעות
        </Link>
      </div>

      <div className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
        <h2 style={{ marginTop: 0, fontSize: '1.05rem', color: 'var(--primary-dark)' }}>סיום מחצית</h2>
        <p className="empty-note">
          פעולה זו מעבירה את נתוני האיחורים/חיסורים/שחרורים הנוכחיים לארכיון, ומאפסת את המונים של כלל התלמידות
          (איחורים, חיסורים, שחרורים, מחזור 8) לקראת המחצית הבאה. הנתונים ההיסטוריים יישארו נגישים בארכיון.
        </p>
        <button className="btn btn-primary" onClick={() => setShowEndSemester(true)}>
          סיום מחצית ואיפוס מונים
        </button>
      </div>

      <div className="card" style={{ padding: '1.25rem' }}>
        <h2 style={{ marginTop: 0, fontSize: '1.05rem', color: 'var(--primary-dark)' }}>מעבר שנת לימודים</h2>
        <p className="empty-note">
          פעולה זו (בסיום השנה) מקדמת את כל הכיתות שכבה אחת למעלה (למשל ט1 הופכת ל-י1), מעבירה את השכבה הבוגרת
          ביותר לארכיון לצמיתות, ופותחת מקום ריק בשכבת הכניסה החדשה לצורך הוספת כיתות ותלמידות חדשות (באותו אופן
          שבו מוסיפים כיתות ומעלים קובץ אקסל בכל שלב אחר). הפעולה גם מסיימת את המחצית הנוכחית ומאפסת מונים,
          ומעדכנת את שנת הלימודים הנוכחית.
        </p>
        <button className="btn btn-danger" onClick={() => setShowRollover(true)}>
          ביצוע מעבר שנה
        </button>
      </div>

      {showEndSemester && (
        <EndSemesterModal scopeParams={scopeParams} onClose={() => setShowEndSemester(false)} />
      )}
      {showRollover && (
        <YearRolloverModal scopeParams={scopeParams} onClose={() => setShowRollover(false)} onDone={loadInstitution} />
      )}
    </div>
  );
}

function PlannedEndDateCard({
  institution,
  scopeParams,
  onUpdated,
}: {
  institution: Institution | null;
  scopeParams: { institutionId?: string };
  onUpdated: () => void;
}) {
  const [date, setDate] = useState(institution?.plannedEndDate ?? '');
  const [nextDate, setNextDate] = useState(institution?.nextPlannedEndDate ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setDate(institution?.plannedEndDate ?? '');
    setNextDate(institution?.nextPlannedEndDate ?? '');
  }, [institution?.plannedEndDate, institution?.nextPlannedEndDate]);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.patch('/semesters/current', {
        plannedEndDate: date || null,
        nextPlannedEndDate: nextDate || null,
        ...scopeParams,
      });
      onUpdated();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
      <h2 style={{ marginTop: 0, fontSize: '1.05rem', color: 'var(--primary-dark)' }}>תאריכי סיום משוערים למחציות</h2>
      <p className="empty-note">
        תאריך הסיום קובע את גבולות המחצית. מספר ימי הלימוד בפועל בתוכה (לצורך מדד החריגות בעמוד כל תלמידה) מחושב לפי
        לוח ימי הלימוד של המוסד - ניתן להעלות קובץ אקסל עם ימי הלימוד המדויקים, או לערוך יום ספציפי ישירות בלוח.
        {institution && !institution.studyDaysAccurate && (
          <>
            {' '}
            <b>שימו לב:</b> עדיין לא הועלה קובץ ימי לימוד למוסד זה (ואין למערכת לוח חגים מובנה לשנה הנוכחית), כך
            שהספירה כרגע היא הערכה גסה (ימי א׳-ה׳ בלבד, בלי ניכוי חגים).
          </>
        )}
      </p>
      <form onSubmit={handleSave}>
        <div className="action-buttons" style={{ alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="form-field" style={{ marginBottom: 0 }}>
            <label>תאריך סיום משוער - מחצית נוכחית</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="form-field" style={{ marginBottom: 0 }}>
            <label>תאריך סיום משוער - מחצית הבאה (מוגדר מראש, ייכנס לתוקף אוטומטית כשהיא תתחיל)</label>
            <input type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)} />
          </div>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            שמירה
          </button>
        </div>
      </form>
      {error && <p className="error-text">{error}</p>}
      <div style={{ marginTop: '1rem' }}>
        <Link to="/school-year/calendar" className="btn btn-outline">
          פתיחת לוח ימי לימוד
        </Link>
      </div>
    </div>
  );
}

function EndSemesterModal({
  scopeParams,
  onClose,
}: {
  scopeParams: { institutionId?: string };
  onClose: () => void;
}) {
  const [confirmText, setConfirmText] = useState('');
  const [plannedEndDate, setPlannedEndDate] = useState('');
  const calendarFileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post('/semesters/end', { plannedEndDate: plannedEndDate || undefined, ...scopeParams });
      const calendarFile = calendarFileRef.current?.files?.[0];
      if (calendarFile) {
        const formData = new FormData();
        formData.append('file', calendarFile);
        const params = new URLSearchParams(scopeParams as Record<string, string>).toString();
        await api.post(`/calendar/upload?${params}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }
      setDone(true);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="אישור סיום מחצית" onClose={onClose}>
      {done ? (
        <>
          <p>המחצית הסתיימה בהצלחה, המונים אופסו והנתונים נשמרו בארכיון.</p>
          <div className="modal-actions">
            <button className="btn btn-primary" onClick={onClose}>
              סגירה
            </button>
          </div>
        </>
      ) : (
        <form onSubmit={handleSubmit}>
          <p className="error-text">פעולה זו תאפס את מוני האיחורים/חיסורים/שחרורים של כל התלמידות במוסד.</p>
          <div className="form-field">
            <label>תאריך סיום משוער למחצית החדשה (אופציונלי, ניתן להגדיר גם מאוחר יותר)</label>
            <input type="date" value={plannedEndDate} onChange={(e) => setPlannedEndDate(e.target.value)} />
          </div>
          <div className="form-field">
            <label>קובץ ימי לימוד למחצית החדשה (אקסל, אופציונלי)</label>
            <input ref={calendarFileRef} type="file" accept=".xlsx,.xls" />
          </div>
          <div className="form-field">
            <label>כדי לאשר, הקלידי "סיום מחצית"</label>
            <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} required />
          </div>
          {error && <p className="error-text">{error}</p>}
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              ביטול
            </button>
            <button type="submit" className="btn btn-danger" disabled={saving || confirmText !== 'סיום מחצית'}>
              אישור וסיום מחצית
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function YearRolloverModal({
  scopeParams,
  onClose,
  onDone,
}: {
  scopeParams: { institutionId?: string };
  onClose: () => void;
  onDone: () => void;
}) {
  const [newYearLabel, setNewYearLabel] = useState('');
  const [plannedEndDate, setPlannedEndDate] = useState('');
  const calendarFileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ promotedGrades: number; graduatedClasses: number } | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await api.post('/semesters/year-rollover', {
        newYearLabel,
        plannedEndDate: plannedEndDate || undefined,
        ...scopeParams,
      });
      const calendarFile = calendarFileRef.current?.files?.[0];
      if (calendarFile) {
        const formData = new FormData();
        formData.append('file', calendarFile);
        const params = new URLSearchParams(scopeParams as Record<string, string>).toString();
        await api.post(`/calendar/upload?${params}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }
      setResult(res.data);
      onDone();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="אישור מעבר שנה" onClose={onClose}>
      {result ? (
        <>
          <p>
            מעבר השנה בוצע בהצלחה: {result.promotedGrades} שכבות קודמו, {result.graduatedClasses} כיתות עברו
            לארכיון. ניתן כעת להוסיף כיתות ותלמידות חדשות לשכבת הכניסה.
          </p>
          <div className="modal-actions">
            <button className="btn btn-primary" onClick={onClose}>
              סגירה
            </button>
          </div>
        </>
      ) : (
        <form onSubmit={handleSubmit}>
          <p className="error-text">
            פעולה זו תקדם את כל הכיתות שכבה, תעביר את השכבה הבוגרת ביותר לארכיון לצמיתות, ותאפס את מוני המחצית.
          </p>
          <div className="form-field">
            <label>שנת הלימודים החדשה (למשל תשפ״ז)</label>
            <input value={newYearLabel} onChange={(e) => setNewYearLabel(e.target.value)} required autoFocus />
          </div>
          <div className="form-field">
            <label>תאריך סיום משוער למחצית החדשה (אופציונלי, ניתן להגדיר גם מאוחר יותר)</label>
            <input type="date" value={plannedEndDate} onChange={(e) => setPlannedEndDate(e.target.value)} />
          </div>
          <div className="form-field">
            <label>קובץ ימי לימוד למחצית החדשה (אקסל, אופציונלי)</label>
            <input ref={calendarFileRef} type="file" accept=".xlsx,.xls" />
          </div>
          {error && <p className="error-text">{error}</p>}
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              ביטול
            </button>
            <button type="submit" className="btn btn-danger" disabled={saving}>
              אישור וביצוע מעבר שנה
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
