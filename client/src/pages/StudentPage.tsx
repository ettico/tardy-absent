import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { api, apiErrorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useScopeParams } from '../hooks/useScope';
import Modal from '../components/Modal';
import Breadcrumbs from '../components/Breadcrumbs';
import DonutChart from '../components/charts/DonutChart';
import TrashIcon from '../components/icons/TrashIcon';
import { toHebrewDateString } from '../utils/hebrewDate';
import type { AttendanceEvent, Student } from '../types';

const EVENT_LABELS: Record<string, string> = { LATE: 'איחור', ABSENCE: 'חיסור', RELEASE: 'שחרור' };
const REDUCE_LABELS: Record<'LATE' | 'ABSENCE' | 'RELEASE', string> = {
  LATE: 'איחורים',
  ABSENCE: 'חיסורים',
  RELEASE: 'שחרורים',
};

function eventTypeLabel(event: AttendanceEvent): string {
  if (event.type === 'LATE') {
    return `${EVENT_LABELS.LATE} (${event.lateApproved ? 'עם אישור' : 'ללא אישור'})`;
  }
  return EVENT_LABELS[event.type];
}
const LATE_COLOR = '#d6a44a';
const ABSENCE_COLOR = '#c0525f';
const RELEASE_COLOR = '#0f8f82';
const APPROVED_COLOR = '#5fa77c';
const UNAPPROVED_COLOR = '#c0525f';

export default function StudentPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const scopeParams = useScopeParams();
  const navigate = useNavigate();
  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [reduceMode, setReduceMode] = useState<'LATE' | 'ABSENCE' | 'RELEASE' | null>(null);
  const [selectedEventIds, setSelectedEventIds] = useState<Set<string>>(new Set());
  const [reducing, setReducing] = useState(false);

  const canEdit = user?.role === 'SYSTEM_ADMIN' || user?.role === 'SECRETARY';

  function load() {
    if (!id) return;
    setLoading(true);
    api
      .get<Student>(`/students/${id}`, { params: scopeParams })
      .then((res) => setStudent(res.data))
      .finally(() => setLoading(false));
  }

  useEffect(load, [id]);

  function showToast(text: string, error = false) {
    setToast({ text, error });
    setTimeout(() => setToast(null), 3500);
  }

  async function handleAction(action: 'late' | 'absence' | 'release', approved?: boolean) {
    if (!student || pendingAction) return;
    const pendingKey = action === 'late' ? `late:${approved ? 'approved' : 'unapproved'}` : action;
    setPendingAction(pendingKey);
    try {
      const body = action === 'late' ? { approved, ...scopeParams } : scopeParams;
      const res = await api.post(`/students/${student.id}/${action}`, body);
      if (res.data.ok === false) showToast(res.data.message ?? 'הפעולה לא בוצעה', true);
      else if (res.data.message) showToast(res.data.message);
      load();
    } catch (err) {
      showToast(apiErrorMessage(err), true);
    } finally {
      setPendingAction(null);
    }
  }

  async function handleSubmitAssignment() {
    if (!student) return;
    await api.post(`/students/${student.id}/submit-assignment`, scopeParams);
    showToast('העבודה סומנה כהוגשה, מונה האיחורים מתחיל מחדש');
    load();
  }

  async function handleDelete() {
    if (!student) return;
    if (!confirm(`למחוק את ${student.fullName} מהמערכת?`)) return;
    await api.delete(`/students/${student.id}`, { params: scopeParams });
    navigate(`/classes/${student.classId}`);
  }

  function startReduce(type: 'LATE' | 'ABSENCE' | 'RELEASE') {
    setReduceMode(type);
    setSelectedEventIds(new Set());
  }

  function cancelReduce() {
    setReduceMode(null);
    setSelectedEventIds(new Set());
  }

  function toggleSelectedEvent(eventId: string) {
    setSelectedEventIds((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) next.delete(eventId);
      else next.add(eventId);
      return next;
    });
  }

  async function handleConfirmReduce() {
    if (!student || !reduceMode || selectedEventIds.size === 0) return;
    const typeLabel = REDUCE_LABELS[reduceMode];
    const confirmed = confirm(`האם את בטוחה שברצונך להפחית ${selectedEventIds.size} ${typeLabel} לתלמידה ${student.fullName}?`);
    if (!confirmed) return;

    setReducing(true);
    try {
      const res = await api.post(`/students/${student.id}/events/remove`, {
        eventIds: Array.from(selectedEventIds),
        ...scopeParams,
      });
      if (res.data.ok === false) showToast(res.data.message ?? 'הפעולה לא בוצעה', true);
      else showToast(res.data.message ?? 'ההפחתה בוצעה בהצלחה.');
      load();
    } catch (err) {
      showToast(apiErrorMessage(err), true);
    } finally {
      setReducing(false);
      cancelReduce();
    }
  }

  if (loading) return <p className="spinner-note">טוענת נתונים...</p>;
  if (!student) return <p className="error-text">תלמידה לא נמצאה</p>;

  const assignmentsOwed = student.assignmentsRequired - student.assignmentsSubmitted;
  const className = student.classRoom?.name;
  const gradeName = student.classRoom?.grade?.name;

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: 'שכבות וכיתות', to: '/' },
          ...(className ? [{ label: `כיתה ${className}${gradeName ? ` (שכבת ${gradeName})` : ''}`, to: `/classes/${student.classId}` }] : []),
          { label: student.fullName },
        ]}
      />
      <div className="page-header">
        <div>
          <h1>{student.fullName}</h1>
          <span className="stat-pill">ת.ז. {student.nationalId}</span>
        </div>
        {canEdit && (
          <div className="action-buttons">
            <button className="btn btn-outline" onClick={() => setShowEdit(true)}>
              עדכון פרטים
            </button>
            <button className="btn btn-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }} onClick={handleDelete}>
              <TrashIcon size={15} />
              מחיקת תלמידה
            </button>
          </div>
        )}
      </div>

      {student.needsAssignment && (
        <div
          className="card"
          style={{
            padding: '1rem 1.25rem',
            marginBottom: '1.25rem',
            borderRight: '5px solid var(--warning)',
          }}
        >
          <strong>📝 נדרשת להגיש עבודה</strong> ({assignmentsOwed} עבודות ממתינות)
          {canEdit && (
            <button className="btn btn-primary btn-sm" style={{ marginRight: '1rem' }} onClick={handleSubmitAssignment}>
              סימון כ"הוגשה עבודה"
            </button>
          )}
        </div>
      )}
      {student.blocked && (
        <div
          className="card"
          style={{
            padding: '1rem 1.25rem',
            marginBottom: '1.25rem',
            borderRight: '5px solid var(--danger)',
          }}
        >
          <strong>⛔ אין לתלמידה רשות כניסה לכיתה</strong> - יש להפנות למנהלת בית הספר.
          <div style={{ marginTop: '0.5rem' }}>
            <Link to={`/students/${student.id}/letter`} className="btn btn-outline btn-sm">
              הדפסת מכתב להורים
            </Link>
          </div>
        </div>
      )}

      <div className="card" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
        <div className="action-buttons" style={{ marginBottom: '1rem' }}>
          <span className="stat-pill">סה"כ איחורים במחצית: {student.totalLateCount}</span>
          <span className="stat-pill">מתוכם עם אישור: {student.totalLateApprovedCount}</span>
          <span className="stat-pill">מתוכם ללא אישור: {student.totalLateUnapprovedCount}</span>
          <span className="stat-pill">סה"כ חיסורים במחצית: {student.totalAbsenceCount}</span>
          <span className="stat-pill">סה"כ שחרורים במחצית: {student.totalReleaseCount}</span>
          <span className="stat-pill">איחורים במחזור הנוכחי: {student.cycleLateCount}/8</span>
        </div>
        {canEdit && (
          <div className="action-buttons">
            <button
              className="btn btn-late"
              disabled={pendingAction === 'late:approved'}
              onClick={() => handleAction('late', true)}
            >
              איחור מאושר
            </button>
            <button
              className="btn btn-late btn-late-unapproved"
              disabled={pendingAction === 'late:unapproved'}
              onClick={() => handleAction('late', false)}
            >
              איחור לא מאושר
            </button>
            <button
              className="btn btn-absence"
              disabled={pendingAction === 'absence'}
              onClick={() => handleAction('absence')}
            >
              חיסור
            </button>
            <button
              className="btn btn-release"
              disabled={pendingAction === 'release'}
              onClick={() => handleAction('release')}
            >
              שחרור
            </button>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem' }}>
        <div className="dashboard-card" style={{ flex: '1 1 260px' }}>
          <h2>סטטוס במחצית הנוכחית</h2>
          <DonutChart
            centerLabel="סה״כ אירועים"
            segments={[
              { key: 'late', label: 'איחורים', color: LATE_COLOR, value: student.totalLateCount },
              { key: 'absence', label: 'חיסורים', color: ABSENCE_COLOR, value: student.totalAbsenceCount },
              { key: 'release', label: 'שחרורים', color: RELEASE_COLOR, value: student.totalReleaseCount },
            ]}
          />
        </div>
        {student.totalLateCount > 0 && (
          <div className="dashboard-card" style={{ flex: '1 1 260px' }}>
            <h2>פילוח איחורים</h2>
            <DonutChart
              centerLabel="סה״כ איחורים"
              segments={[
                { key: 'approved', label: 'עם אישור', color: APPROVED_COLOR, value: student.totalLateApprovedCount },
                { key: 'unapproved', label: 'ללא אישור', color: UNAPPROVED_COLOR, value: student.totalLateUnapprovedCount },
              ]}
            />
          </div>
        )}
      </div>

      <h2 style={{ color: 'var(--primary-dark)', fontSize: '1.1rem' }}>היסטוריית אירועים</h2>

      {canEdit && (
        <div className="action-buttons" style={{ marginBottom: '0.75rem' }}>
          <button
            className="btn btn-outline btn-sm"
            disabled={!!reduceMode || student.totalLateCount === 0}
            onClick={() => startReduce('LATE')}
          >
            הורדת איחורים
          </button>
          <button
            className="btn btn-outline btn-sm"
            disabled={!!reduceMode || student.totalAbsenceCount === 0}
            onClick={() => startReduce('ABSENCE')}
          >
            הורדת חיסורים
          </button>
          <button
            className="btn btn-outline btn-sm"
            disabled={!!reduceMode || student.totalReleaseCount === 0}
            onClick={() => startReduce('RELEASE')}
          >
            הורדת שחרורים
          </button>
        </div>
      )}

      {reduceMode && (
        <div
          className="card"
          style={{
            padding: '0.75rem 1rem',
            marginBottom: '0.75rem',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.75rem',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>סמני V ליד ה{REDUCE_LABELS[reduceMode]} שברצונך להפחית בטבלה למטה.</span>
          <div className="action-buttons">
            <button type="button" className="btn btn-ghost btn-sm" onClick={cancelReduce}>
              ביטול
            </button>
            <button
              type="button"
              className="btn btn-danger btn-sm"
              disabled={reducing || selectedEventIds.size === 0}
              onClick={handleConfirmReduce}
            >
              הפחתת {selectedEventIds.size || ''} {REDUCE_LABELS[reduceMode]}
            </button>
          </div>
        </div>
      )}

      <table className="data-table">
        <thead>
          <tr>
            {reduceMode && <th></th>}
            <th>תאריך</th>
            <th>שעה</th>
            <th>סוג</th>
          </tr>
        </thead>
        <tbody>
          {(student.events ?? []).map((event) => (
            <tr key={event.id}>
              {reduceMode && (
                <td>
                  {event.type === reduceMode && (
                    <input
                      type="checkbox"
                      checked={selectedEventIds.has(event.id)}
                      onChange={() => toggleSelectedEvent(event.id)}
                    />
                  )}
                </td>
              )}
              <td>{toHebrewDateString(event.date)}</td>
              <td>{event.time ?? '-'}</td>
              <td>
                {eventTypeLabel(event)}
                {event.overflow && ' (מעבר למכסה - נספר במחצית בלבד)'}
              </td>
            </tr>
          ))}
          {(student.events ?? []).length === 0 && (
            <tr>
              <td colSpan={reduceMode ? 4 : 3} className="empty-note">
                אין עדיין אירועים רשומים.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {showEdit && (
        <EditStudentModal
          student={student}
          scopeParams={scopeParams}
          onClose={() => setShowEdit(false)}
          onUpdated={() => {
            setShowEdit(false);
            load();
          }}
        />
      )}
      {toast && <div className={`toast ${toast.error ? 'error' : ''}`}>{toast.text}</div>}
    </div>
  );
}

function EditStudentModal({
  student,
  scopeParams,
  onClose,
  onUpdated,
}: {
  student: Student;
  scopeParams: { institutionId?: string };
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [fullName, setFullName] = useState(student.fullName);
  const [nationalId, setNationalId] = useState(student.nationalId);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.patch(`/students/${student.id}`, { fullName, nationalId, ...scopeParams });
      onUpdated();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="עדכון פרטי תלמידה" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="form-field">
          <label>שם מלא</label>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        </div>
        <div className="form-field">
          <label>מספר זהות</label>
          <input value={nationalId} onChange={(e) => setNationalId(e.target.value)} required />
        </div>
        {error && <p className="error-text">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            ביטול
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            שמירה
          </button>
        </div>
      </form>
    </Modal>
  );
}

