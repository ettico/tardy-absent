import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, apiErrorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useScopeParams } from '../hooks/useScope';
import Modal from '../components/Modal';
import Breadcrumbs from '../components/Breadcrumbs';
import type { ClassRoom, Student } from '../types';

export default function ClassPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const scopeParams = useScopeParams();
  const navigate = useNavigate();
  const [classRoom, setClassRoom] = useState<ClassRoom | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(null);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showRenameClass, setShowRenameClass] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [pendingActions, setPendingActions] = useState<Set<string>>(new Set());

  const canEdit = user?.role === 'SYSTEM_ADMIN' || user?.role === 'SECRETARY';

  function load() {
    if (!id) return;
    setLoading(true);
    api
      .get<ClassRoom>(`/classes/${id}`, { params: scopeParams })
      .then((res) => setClassRoom(res.data))
      .finally(() => setLoading(false));
  }

  useEffect(load, [id]);

  function showToast(text: string, error = false) {
    setToast({ text, error });
    setTimeout(() => setToast(null), 3500);
  }

  async function handleAction(studentId: string, action: 'late' | 'absence' | 'release') {
    const key = `${studentId}:${action}`;
    if (pendingActions.has(key)) return;
    setPendingActions((prev) => new Set(prev).add(key));
    try {
      const res = await api.post(`/students/${studentId}/${action}`, scopeParams);
      if (res.data.ok === false) {
        showToast(res.data.message ?? 'הפעולה לא בוצעה', true);
      } else if (res.data.message) {
        showToast(res.data.message);
      }
      load();
    } catch (err) {
      showToast(apiErrorMessage(err), true);
    } finally {
      setPendingActions((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }

  async function handleSubmitAssignment(studentId: string) {
    const key = `${studentId}:submit-assignment`;
    if (pendingActions.has(key)) return;
    setPendingActions((prev) => new Set(prev).add(key));
    try {
      await api.post(`/students/${studentId}/submit-assignment`, scopeParams);
      showToast('העבודה סומנה כהוגשה, מונה האיחורים מתחיל מחדש');
      load();
    } catch (err) {
      showToast(apiErrorMessage(err), true);
    } finally {
      setPendingActions((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }

  async function handleDeleteClass() {
    if (!classRoom) return;
    if (!confirm(`למחוק את כיתה ${classRoom.name}? פעולה זו תמחק גם את כל התלמידות והנתונים שלהן.`)) return;
    await api.delete(`/classes/${classRoom.id}`, { params: scopeParams });
    navigate('/');
  }

  if (loading) return <p className="spinner-note">טוענת נתונים...</p>;
  if (!classRoom) return <p className="error-text">כיתה לא נמצאה</p>;

  return (
    <div>
      <Breadcrumbs items={[{ label: 'שכבות וכיתות', to: '/' }, { label: `כיתה ${classRoom.name}` }]} />
      <div className="page-header">
        <div>
          <h1>כיתה {classRoom.name}</h1>
          <span className="stat-pill">שכבת {classRoom.grade?.name}</span>
        </div>
        <div className="action-buttons">
          <Link to={`/reports/class/${classRoom.id}/print`} className="btn btn-outline" target="_blank">
            דוח סיכום איחורים וחיסורים
          </Link>
          <Link to={`/reports/class/${classRoom.id}/booklet`} className="btn btn-outline" target="_blank">
            חוברת מפורטת למורה
          </Link>
          {canEdit && (
            <>
              <button className="btn btn-outline" onClick={() => setShowImport(true)}>
                העלאת קובץ אקסל
              </button>
              <button className="btn btn-outline" onClick={() => setShowAddStudent(true)}>
                + הוספת תלמידה
              </button>
              <button className="btn btn-ghost" onClick={() => setShowRenameClass(true)}>
                עדכון שם כיתה
              </button>
              <button className="btn btn-danger" onClick={handleDeleteClass}>
                מחיקת כיתה
              </button>
            </>
          )}
        </div>
      </div>

      {(classRoom.students ?? []).length > 0 && (
        <div className="form-field" style={{ maxWidth: 280 }}>
          <input
            type="search"
            placeholder="חיפוש תלמידה בכיתה..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
          />
        </div>
      )}

      <div className="card">
        {(classRoom.students ?? []).length === 0 && (
          <p className="empty-note" style={{ padding: '1rem' }}>
            אין עדיין תלמידות בכיתה זו. ניתן להוסיף ידנית או להעלות קובץ אקסל.
          </p>
        )}
        {(classRoom.students ?? [])
          .filter((s) => s.fullName.includes(filterText.trim()))
          .map((student) => (
            <StudentRow
              key={student.id}
              student={student}
              canEdit={canEdit}
              onAction={handleAction}
              onSubmitAssignment={handleSubmitAssignment}
              pendingActions={pendingActions}
            />
          ))}
        {(classRoom.students ?? []).length > 0 &&
          (classRoom.students ?? []).filter((s) => s.fullName.includes(filterText.trim())).length === 0 && (
            <p className="empty-note" style={{ padding: '1rem' }}>
              לא נמצאו תלמידות התואמות לחיפוש.
            </p>
          )}
      </div>

      {showAddStudent && (
        <AddStudentModal
          classId={classRoom.id}
          scopeParams={scopeParams}
          onClose={() => setShowAddStudent(false)}
          onCreated={() => {
            setShowAddStudent(false);
            load();
          }}
        />
      )}
      {showImport && (
        <ImportModal
          classId={classRoom.id}
          scopeParams={scopeParams}
          onClose={() => setShowImport(false)}
          onImported={() => {
            setShowImport(false);
            load();
          }}
        />
      )}
      {showRenameClass && (
        <RenameClassModal
          classRoom={classRoom}
          scopeParams={scopeParams}
          onClose={() => setShowRenameClass(false)}
          onUpdated={() => {
            setShowRenameClass(false);
            load();
          }}
        />
      )}
      {toast && <div className={`toast ${toast.error ? 'error' : ''}`}>{toast.text}</div>}
    </div>
  );
}

function StudentRow({
  student,
  canEdit,
  onAction,
  onSubmitAssignment,
  pendingActions,
}: {
  student: Student;
  canEdit: boolean;
  onAction: (studentId: string, action: 'late' | 'absence' | 'release') => void;
  onSubmitAssignment: (studentId: string) => void;
  pendingActions: Set<string>;
}) {
  const isPending = (action: 'late' | 'absence' | 'release') => pendingActions.has(`${student.id}:${action}`);
  const isSubmittingAssignment = pendingActions.has(`${student.id}:submit-assignment`);
  return (
    <div className="student-row">
      <div className="student-name-wrap">
        <Link to={`/students/${student.id}`} className="student-name">
          {student.fullName}
        </Link>
        {student.needsAssignment && !student.blocked && (
          <span className="badge-icon badge-assignment" title="נדרשת להגיש עבודה">
            📝 עבודה
          </span>
        )}
        {student.blocked && (
          <span className="badge-icon badge-blocked" title="אין רשות כניסה לכיתה">
            ⛔ אין כניסה
          </span>
        )}
        {canEdit && student.needsAssignment && (
          <button
            className="btn btn-outline btn-sm"
            disabled={isSubmittingAssignment}
            onClick={() => onSubmitAssignment(student.id)}
          >
            הוגשה עבודה
          </button>
        )}
      </div>
      <div className="action-buttons">
        <span className="stat-pill">איחורים: {student.totalLateCount}</span>
        <span className="stat-pill">חיסורים: {student.totalAbsenceCount}</span>
        <span className="stat-pill">שחרורים: {student.totalReleaseCount}</span>
      </div>
      {canEdit && (
        <div className="action-buttons">
          <button
            className="btn btn-late btn-sm"
            disabled={isPending('late')}
            onClick={() => onAction(student.id, 'late')}
          >
            איחור
          </button>
          <button
            className="btn btn-absence btn-sm"
            disabled={isPending('absence')}
            onClick={() => onAction(student.id, 'absence')}
          >
            חיסור
          </button>
          <button
            className="btn btn-release btn-sm"
            disabled={isPending('release')}
            onClick={() => onAction(student.id, 'release')}
          >
            שחרור
          </button>
        </div>
      )}
    </div>
  );
}

function AddStudentModal({
  classId,
  scopeParams,
  onClose,
  onCreated,
}: {
  classId: string;
  scopeParams: { institutionId?: string };
  onClose: () => void;
  onCreated: () => void;
}) {
  const [fullName, setFullName] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post('/students', { fullName, nationalId, classId, ...scopeParams });
      onCreated();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="הוספת תלמידה" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="form-field">
          <label>שם מלא</label>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} autoFocus required />
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
            הוספה
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ImportModal({
  classId,
  scopeParams,
  onClose,
  onImported,
}: {
  classId: string;
  scopeParams: { institutionId?: string };
  onClose: () => void;
  onImported: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError('יש לבחור קובץ');
      return;
    }
    setSaving(true);
    setError('');
    const formData = new FormData();
    formData.append('file', file);
    try {
      const params = new URLSearchParams(scopeParams as Record<string, string>).toString();
      const res = await api.post(`/students/class/${classId}/import?${params}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setSuccess(`יובאו ${res.data.imported} תלמידות בהצלחה`);
      setTimeout(onImported, 1000);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="העלאת רשימת תלמידות מקובץ אקסל" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <p className="empty-note">
          הקובץ צריך לכלול כותרות עמודות: <b>שם</b> (שם התלמידה) ו-<b>ת.ז.</b> (מספר זהות).
        </p>
        <div className="form-field">
          <input ref={fileRef} type="file" accept=".xlsx,.xls" required />
        </div>
        {error && <p className="error-text">{error}</p>}
        {success && <p style={{ color: 'var(--success)' }}>{success}</p>}
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            ביטול
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'מייבאת...' : 'ייבוא'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function RenameClassModal({
  classRoom,
  scopeParams,
  onClose,
  onUpdated,
}: {
  classRoom: ClassRoom;
  scopeParams: { institutionId?: string };
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [name, setName] = useState(classRoom.name);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.patch(`/classes/${classRoom.id}`, { name, ...scopeParams });
      onUpdated();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="עדכון שם כיתה" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="form-field">
          <label>שם הכיתה</label>
          <input value={name} onChange={(e) => setName(e.target.value)} autoFocus required />
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
