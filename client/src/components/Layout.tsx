import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useInstitution } from '../context/InstitutionContext';

const ROLE_LABELS: Record<string, string> = {
  SYSTEM_ADMIN: 'מנהלת מערכת',
  SECRETARY: 'מזכירה',
  PRINCIPAL: 'מנהלת בית ספר',
};

export default function Layout() {
  const { user, logout } = useAuth();
  const { institutions, selectedInstitutionId, setSelectedInstitutionId } = useInstitution();
  const navigate = useNavigate();

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link to="/" className="topbar-title">
          מערכת איחורים וחיסורים
        </Link>
        <div className="topbar-right">
          {user?.role === 'SYSTEM_ADMIN' && institutions.length > 0 && (
            <select
              value={selectedInstitutionId ?? ''}
              onChange={(e) => setSelectedInstitutionId(e.target.value)}
              aria-label="בחירת מוסד"
            >
              {institutions.map((inst) => (
                <option key={inst.id} value={inst.id}>
                  {inst.name}
                </option>
              ))}
            </select>
          )}
          {user?.role === 'SYSTEM_ADMIN' && <Link to="/admin/users">ניהול משתמשים ומוסדות</Link>}
          {user && <span className="role-badge">{ROLE_LABELS[user.role]}</span>}
          <span>{user?.fullName}</span>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              logout();
              navigate('/login');
            }}
          >
            התנתקות
          </button>
        </div>
      </header>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
