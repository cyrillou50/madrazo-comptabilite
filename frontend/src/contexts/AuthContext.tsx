import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, asData } from '../lib/api';
import { setCurrencyCode } from '../lib/format';
import type { Preferences, User } from '../types';

interface AuthValue {
  user: User | null;
  preferences: Preferences;
  loading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  can: (permission: string) => boolean;
}

const defaultPreferences: Preferences = { organizationName: 'MADRAZO', currency: 'USD', debtWarningDays: 30, defaultPageSize: 25, launderingFeePercent: 0 };

const AuthContext = createContext<AuthValue | null>(null);

function preferencesOf(user: User | null): Preferences {
  return { ...defaultPreferences, ...(user?.preferences ?? {}) };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const setUser = useCallback((next: User | null) => {
    setCurrencyCode(preferencesOf(next).currency);
    setUserState(next);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const response = await api.get<any>('/auth/me');
      setUser(asData<User>(response));
      setError(null);
    } catch (reason: any) {
      if (reason?.status !== 401) setError(reason?.message || 'Impossible de vérifier la session.');
      setUser(null);
    } finally { setLoading(false); }
  }, [setUser]);

  useEffect(() => {
    void refresh();
    const unauthorized = () => setUser(null);
    window.addEventListener('madrazo:unauthorized', unauthorized);
    return () => window.removeEventListener('madrazo:unauthorized', unauthorized);
  }, [refresh, setUser]);

  const login = useCallback(async (username: string, password: string) => {
    setError(null);
    const response = await api.post<any>('/auth/login', { username, password });
    setUser(asData<User>(response));
  }, [setUser]);

  const logout = useCallback(async () => {
    try { await api.post('/auth/logout'); } finally {
      api.clearCsrf();
      setUser(null);
    }
  }, [setUser]);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    await api.post('/auth/password', { currentPassword, newPassword });
  }, []);

  const value = useMemo<AuthValue>(() => ({
    user, preferences: preferencesOf(user), loading, error, login, logout, refresh, changePassword,
    // Les droits viennent uniquement des permissions effectives renvoyées par l'API (rôle + exceptions).
    can: (permission) => !!user && (user.permissions?.includes('*') || user.permissions?.includes(permission)),
  }), [user, loading, error, login, logout, refresh, changePassword]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Ce hook partage volontairement le fichier du provider de contexte.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth doit être utilisé dans AuthProvider');
  return value;
}
