import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { api, apiErrorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useScopeParams } from '../hooks/useScope';
import Modal from '../components/Modal';
import Breadcrumbs from '../components/Breadcrumbs';
import { toHebrewDateString } from '../utils/hebrewDate';
import type { Student } from '../types';

const EVENT_LABELS: Record<string, string> = { LATE: 'איחור', ABSENCE: 'חיסור', RELEASE: 'שחרור' };

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

  async function handleAction(action: 'late' | 'absence' | 'release') {
    if (!student || pendingAction) return;
    setPendingAction(action);
    try {
      const res = await api.post(`/students/${student.id}/${action}`, scopeParams);
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
            <button className="btn btn-danger" onClick={handleDelete}>
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
          <span className="stat-pill">סה"כ חיסורים במחצית: {student.totalAbsenceCount}</span>
          <span className="stat-pill">סה"כ שחרורים במחצית: {student.totalReleaseCount}</span>
          <span className="stat-pill">איחורים במחזור הנוכחי: {student.cycleLateCount}/8</span>
        </div>
        {canEdit && (
          <div className="action-buttons">
            <button className="btn btn-late" disabled={pendingAction === 'late'} onClick={() => handleAction('late')}>
              איחור
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

      <h2 style={{ color: 'var(--primary-dark)', fontSize: '1.1rem' }}>היסטוריית אירועים</h2>
      <table className="data-table">
        <thead>
          <tr>
            <th>תאריך</th>
            <th>שעה</th>
            <th>סוג</th>
          </tr>
        </thead>
        <tbody>
          {(student.events ?? []).map((event) => (
            <tr key={event.id}>
              <td>{toHebrewDateString(event.date)}</td>
              <td>{event.time ?? '-'}</td>
              <td>
                {EVENT_LABELS[event.type]}
                {event.overflow && ' (מעבר למכסה - נספר במחצית בלבד)'}
              </td>
            </tr>
          ))}
          {(student.events ?? []).length === 0 && (
            <tr>
              <td colSpan={3} className="empty-note">
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
