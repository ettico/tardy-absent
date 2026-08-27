import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api, apiErrorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useScopeParams } from '../hooks/useScope';
import Modal from '../components/Modal';
import type { Grade } from '../types';

export default function GradesPage() {
  const { user } = useAuth();
  const scopeParams = useScopeParams();
  const [grades, setGrades] = useState<Grade[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddGrade, setShowAddGrade] = useState(false);
  const [showAddClass, setShowAddClass] = useState<string | null>(null); // gradeId

  function load() {
    setLoading(true);
    api
      .get<Grade[]>('/grades', { params: scopeParams })
      .then((res) => setGrades(res.data))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (user?.role === 'SYSTEM_ADMIN' && !scopeParams.institutionId) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeParams.institutionId]);

  if (loading) return <p className="spinner-note">טוענת נתונים...</p>;

  return (
    <div>
      <div className="page-header">
        <h1>כיתות לפי שכבות</h1>
        {user?.role === 'SYSTEM_ADMIN' && (
          <button className="btn btn-primary" onClick={() => setShowAddGrade(true)}>
            + הוספת שכבה
          </button>
        )}
      </div>

      {grades.length === 0 && <p className="empty-note">עדיין לא הוגדרו שכבות במוסד זה.</p>}

      {grades.map((grade) => (
        <section className="grade-section" key={grade.id}>
          <div className="grade-header" style={{ background: grade.color }}>
            <span>שכבת {grade.name}</span>
            {(user?.role === 'SYSTEM_ADMIN' || user?.role === 'SECRETARY') && (
              <button
                className="btn btn-sm"
                style={{ background: 'rgba(255,255,255,0.25)', color: 'white' }}
                onClick={() => setShowAddClass(grade.id)}
              >
                + הוספת כיתה
              </button>
            )}
          </div>
          <div className="grade-body">
            {grade.classes.length === 0 && <p className="empty-note">אין עדיין כיתות בשכבה זו.</p>}
            {grade.classes.map((cls) => (
              <Link to={`/classes/${cls.id}`} className="class-tile" key={cls.id}>
                <span className="class-name">{cls.name}</span>
                <span className="class-count">{cls._count?.students ?? 0} תלמידות</span>
              </Link>
            ))}
          </div>
        </section>
      ))}

      {showAddGrade && (
        <AddGradeModal
          scopeParams={scopeParams}
          onClose={() => setShowAddGrade(false)}
          onCreated={() => {
            setShowAddGrade(false);
            load();
          }}
        />
      )}
      {showAddClass && (
        <AddClassModal
          gradeId={showAddClass}
          scopeParams={scopeParams}
          onClose={() => setShowAddClass(null)}
          onCreated={() => {
            setShowAddClass(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function AddGradeModal({
  scopeParams,
  onClose,
  onCreated,
}: {
  scopeParams: { institutionId?: string };
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post('/grades', { name, ...scopeParams });
      onCreated();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="הוספת שכבה חדשה" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="form-field">
          <label>שם השכבה (למשל: ט, י, יא, יב)</label>
          <input value={name} onChange={(e) => setName(e.target.value)} autoFocus required />
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

function AddClassModal({
  gradeId,
  scopeParams,
  onClose,
  onCreated,
}: {
  gradeId: string;
  scopeParams: { institutionId?: string };
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post('/classes', { name, gradeId, ...scopeParams });
      onCreated();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="הוספת כיתה" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="form-field">
          <label>שם הכיתה (למשל: ט4)</label>
          <input value={name} onChange={(e) => setName(e.target.value)} autoFocus required />
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
