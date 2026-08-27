import { useEffect, useState, type FormEvent } from 'react';
import { api, apiErrorMessage } from '../api/client';
import { useInstitution } from '../context/InstitutionContext';
import Modal from '../components/Modal';
import type { AppUser } from '../types';

const ROLE_LABELS: Record<string, string> = { SECRETARY: 'מזכירה', PRINCIPAL: 'מנהלת בית ספר' };

export default function UsersAdminPage() {
  const { institutions, refreshInstitutions } = useInstitution();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [showAddInstitution, setShowAddInstitution] = useState(false);
  const [showAddUser, setShowAddUser] = useState(false);

  function loadUsers() {
    api.get<AppUser[]>('/users').then((res) => setUsers(res.data));
  }

  useEffect(loadUsers, []);

  async function handleDeleteUser(id: string) {
    if (!confirm('למחוק את המשתמשת?')) return;
    await api.delete(`/users/${id}`);
    loadUsers();
  }

  return (
    <div>
      <div className="page-header">
        <h1>ניהול מוסדות ומשתמשים</h1>
      </div>

      <div className="page-header">
        <h2 style={{ fontSize: '1.1rem', color: 'var(--primary-dark)', margin: 0 }}>מוסדות</h2>
        <button className="btn btn-outline" onClick={() => setShowAddInstitution(true)}>
          + הוספת מוסד
        </button>
      </div>
      <div className="card" style={{ padding: '1rem 1.25rem', marginBottom: '2rem' }}>
        {institutions.length === 0 && <p className="empty-note">אין עדיין מוסדות במערכת.</p>}
        <ul style={{ margin: 0, paddingRight: '1.2rem' }}>
          {institutions.map((inst) => (
            <li key={inst.id}>
              {inst.name} ({inst._count?.grades ?? 0} שכבות, {inst._count?.users ?? 0} משתמשות)
            </li>
          ))}
        </ul>
      </div>

      <div className="page-header">
        <h2 style={{ fontSize: '1.1rem', color: 'var(--primary-dark)', margin: 0 }}>מזכירות ומנהלות בית ספר</h2>
        <button className="btn btn-primary" onClick={() => setShowAddUser(true)} disabled={institutions.length === 0}>
          + הוספת משתמשת
        </button>
      </div>
      <table className="data-table">
        <thead>
          <tr>
            <th>שם מלא</th>
            <th>שם משתמש</th>
            <th>תפקיד</th>
            <th>מוסד</th>
            <th>אימייל</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>{u.fullName}</td>
              <td>{u.username}</td>
              <td>{ROLE_LABELS[u.role]}</td>
              <td>{u.institution?.name}</td>
              <td>{u.email}</td>
              <td>
                <button className="btn btn-danger btn-sm" onClick={() => handleDeleteUser(u.id)}>
                  מחיקה
                </button>
              </td>
            </tr>
          ))}
          {users.length === 0 && (
            <tr>
              <td colSpan={6} className="empty-note">
                אין עדיין משתמשות רשומות.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {showAddInstitution && (
        <AddInstitutionModal
          onClose={() => setShowAddInstitution(false)}
          onCreated={() => {
            setShowAddInstitution(false);
            refreshInstitutions();
          }}
        />
      )}
      {showAddUser && (
        <AddUserModal
          institutions={institutions}
          onClose={() => setShowAddUser(false)}
          onCreated={() => {
            setShowAddUser(false);
            loadUsers();
          }}
        />
      )}
    </div>
  );
}

function AddInstitutionModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [initialYearLabel, setInitialYearLabel] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post('/institutions', { name, initialYearLabel });
      onCreated();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="הוספת מוסד חדש" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="form-field">
          <label>שם המוסד</label>
          <input value={name} onChange={(e) => setName(e.target.value)} autoFocus required />
        </div>
        <div className="form-field">
          <label>שנת לימודים נוכחית (למשל תשפ״ו) - אופציונלי</label>
          <input value={initialYearLabel} onChange={(e) => setInitialYearLabel(e.target.value)} />
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

function AddUserModal({
  institutions,
  onClose,
  onCreated,
}: {
  institutions: { id: string; name: string }[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'SECRETARY' | 'PRINCIPAL'>('SECRETARY');
  const [institutionId, setInstitutionId] = useState(institutions[0]?.id ?? '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post('/users', { fullName, username, password, email, role, institutionId });
      onCreated();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="הוספת משתמשת חדשה" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="form-field">
          <label>תפקיד</label>
          <select value={role} onChange={(e) => setRole(e.target.value as 'SECRETARY' | 'PRINCIPAL')}>
            <option value="SECRETARY">מזכירה</option>
            <option value="PRINCIPAL">מנהלת בית ספר</option>
          </select>
        </div>
        <div className="form-field">
          <label>מוסד</label>
          <select value={institutionId} onChange={(e) => setInstitutionId(e.target.value)}>
            {institutions.map((inst) => (
              <option key={inst.id} value={inst.id}>
                {inst.name}
              </option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label>שם מלא</label>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        </div>
        <div className="form-field">
          <label>שם משתמש</label>
          <input value={username} onChange={(e) => setUsername(e.target.value)} required />
        </div>
        <div className="form-field">
          <label>סיסמה (לפחות 6 תווים)</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
        </div>
        <div className="form-field">
          <label>אימייל (למנהלת - חובה לצורך התראות)</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
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
