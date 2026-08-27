import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, apiErrorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import PasswordInput from '../components/PasswordInput';
import type { AuthUser } from '../types';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post<{ token: string; user: AuthUser }>('/auth/login', { username, password });
      login(res.data.token, res.data.user);
      navigate('/');
    } catch (err) {
      setError(apiErrorMessage(err, 'שם משתמש או סיסמה שגויים'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <h1>מערכת איחורים וחיסורים</h1>
        <p className="subtitle">התחברות למערכת</p>
        <form onSubmit={handleSubmit}>
          <div className="form-field">
            <label htmlFor="username">שם משתמש</label>
            <input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              required
            />
          </div>
          <div className="form-field">
            <label htmlFor="password">סיסמה</label>
            <PasswordInput id="password" value={password} onChange={setPassword} required />
          </div>
          {error && <p className="error-text">{error}</p>}
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'מתחברת...' : 'התחברות'}
          </button>
        </form>
      </div>
    </div>
  );
}
