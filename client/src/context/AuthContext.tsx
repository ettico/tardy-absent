import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { AuthUser } from '../types';

interface AuthContextValue {
  user: AuthUser | null;
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function loadStoredUser(): AuthUser | null {
  const raw = localStorage.getItem('user');
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(loadStoredUser);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      login: (token, loggedInUser) => {
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(loggedInUser));
        setUser(loggedInUser);
      },
      logout: () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
      },
    }),
    [user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
