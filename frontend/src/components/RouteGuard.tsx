import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LoadingState } from './ui';

export function RouteGuard({ children, permission }: { children: ReactNode; permission?: string }) {
  const { loading, user, can } = useAuth();
  if (loading) return <div className="grid min-h-screen place-items-center bg-ink-950"><LoadingState label="Vérification de la session…" /></div>;
  if (!user) return <Navigate to="/connexion" replace />;
  if (permission && !can(permission)) return <Navigate to="/interdit" replace />;
  return <>{children}</>;
}
