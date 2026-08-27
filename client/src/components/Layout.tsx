import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useInstitution } from '../context/InstitutionContext';
import GlobalSearch from './GlobalSearch';

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
        <nav className="topbar-nav">
          <NavLink to="/" end className={({ isActive }) => (isActive ? 'nav-tab active' : 'nav-tab')}>
            שכבות וכיתות
          </NavLink>
          <NavLink to="/reports/at-risk" className={({ isActive }) => (isActive ? 'nav-tab active' : 'nav-tab')}>
            תלמידות בחריגה
          </NavLink>
          <NavLink
            to="/reports/institution-summary"
            className={({ isActive }) => (isActive ? 'nav-tab active' : 'nav-tab')}
          >
            דוח מנהלים
          </NavLink>
          <NavLink to="/archive" className={({ isActive }) => (isActive ? 'nav-tab active' : 'nav-tab')}>
            ארכיון
          </NavLink>
          {(user?.role === 'SYSTEM_ADMIN' || user?.role === 'PRINCIPAL') && (
            <NavLink to="/school-year" className={({ isActive }) => (isActive ? 'nav-tab active' : 'nav-tab')}>
              מחצית ושנה
            </NavLink>
          )}
          {user?.role === 'SYSTEM_ADMIN' && (
            <NavLink to="/admin/users" className={({ isActive }) => (isActive ? 'nav-tab active' : 'nav-tab')}>
              ניהול משתמשים ומוסדות
            </NavLink>
          )}
        </nav>
        <GlobalSearch />
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
