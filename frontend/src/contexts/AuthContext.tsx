import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, asData } from '../lib/api';
import type { User } from '../types';

interface AuthValue {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  can: (permission: string) => boolean;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await api.get<any>('/auth/me');
      setUser(asData<User>(response));
      setError(null);
    } catch (reason: any) {
      if (reason?.status !== 401) setError(reason?.message || 'Impossible de vérifier la session.');
      setUser(null);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    void refresh();
    const unauthorized = () => setUser(null);
    window.addEventListener('madrazo:unauthorized', unauthorized);
    return () => window.removeEventListener('madrazo:unauthorized', unauthorized);
  }, [refresh]);

  const login = useCallback(async (identifier: string, password: string) => {
    setError(null);
    const response = await api.post<any>('/auth/login', { identifier, username: identifier, password });
    setUser(asData<User>(response));
  }, []);

  const logout = useCallback(async () => {
    try { await api.post('/auth/logout'); } finally {
      api.clearCsrf();
      setUser(null);
    }
  }, []);

  const value = useMemo<AuthValue>(() => ({
    user, loading, error, login, logout, refresh,
    can: (permission) => !!user && (user.role.toLowerCase() === 'patron' || user.permissions?.includes('*') || user.permissions?.includes(permission)),
  }), [user, loading, error, login, logout, refresh]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Ce hook partage volontairement le fichier du provider de contexte.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth doit être utilisé dans AuthProvider');
  return value;
}
