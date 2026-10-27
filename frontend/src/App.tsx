import { lazy, Suspense } from 'react';
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppearanceProvider } from './contexts/AppearanceContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ConfirmProvider } from './contexts/ConfirmContext';
import { ToastProvider } from './contexts/ToastContext';
import { AppShell } from './components/AppShell';
import { RouteGuard } from './components/RouteGuard';
import { firstAllowedPath } from './lib/navigation';
import { LoginPage } from './pages/LoginPage';
const DashboardPage = lazy(() => import('./pages/DashboardPage').then((module) => ({ default: module.DashboardPage })));
const GroupsPage = lazy(() => import('./pages/GroupsPage').then((module) => ({ default: module.GroupsPage })));
const ContactsPage = lazy(() => import('./pages/ContactsPage').then((module) => ({ default: module.ContactsPage })));
const CatalogPage = lazy(() => import('./pages/CatalogPage').then((module) => ({ default: module.CatalogPage })));
const StockPage = lazy(() => import('./pages/StockPage').then((module) => ({ default: module.StockPage })));
const OrdersPage = lazy(() => import('./pages/OrdersPage').then((module) => ({ default: module.OrdersPage })));
const PaymentsPage = lazy(() => import('./pages/PaymentsPage').then((module) => ({ default: module.PaymentsPage })));
const FinancePage = lazy(() => import('./pages/FinancePage').then((module) => ({ default: module.FinancePage })));
const UsersPage = lazy(() => import('./pages/UsersPage').then((module) => ({ default: module.UsersPage })));
const AuditPage = lazy(() => import('./pages/AuditPage').then((module) => ({ default: module.AuditPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((module) => ({ default: module.SettingsPage })));
const ForbiddenPage = lazy(() => import('./pages/StatusPages').then((module) => ({ default: module.ForbiddenPage })));
const NotFoundPage = lazy(() => import('./pages/StatusPages').then((module) => ({ default: module.NotFoundPage })));

function PageFallback() {
  return <div className="grid min-h-64 place-items-center" role="status"><span className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-800 border-t-blood-400" /><span className="sr-only">Chargement de la page</span></div>;
}

function Private({ children, permission }: { children: React.ReactNode; permission?: string }) {
  return <RouteGuard permission={permission}><AppShell><Suspense fallback={<PageFallback />}>{children}</Suspense></AppShell></RouteGuard>;
}
function LoginRoute() { const { user, loading } = useAuth(); const location = useLocation(); if (!loading && user) return <Navigate to="/" replace state={{ from: location }} />; return <LoginPage />; }

// Un rôle sans accès au tableau de bord arrive directement sur sa première rubrique autorisée.
function Home() {
  const { can } = useAuth();
  if (can('dashboard.read')) return <DashboardPage />;
  const path = firstAllowedPath(can);
  return path && path !== '/' ? <Navigate to={path} replace /> : <ForbiddenPage />;
}

export default function App() {
  return <HashRouter><AuthProvider><AppearanceProvider><ToastProvider><ConfirmProvider><Routes>
    <Route path="/connexion" element={<LoginRoute />} />
    <Route path="/" element={<Private><Home /></Private>} />
    <Route path="/groupes" element={<Private permission="groups.read"><GroupsPage /></Private>} />
    <Route path="/contacts" element={<Private permission="contacts.read"><ContactsPage /></Private>} />
    <Route path="/catalogue" element={<Private permission="catalog.read"><CatalogPage /></Private>} />
    <Route path="/stocks" element={<Private permission="stocks.read"><StockPage /></Private>} />
    <Route path="/ventes" element={<Private permission="orders.read"><OrdersPage /></Private>} />
    <Route path="/paiements" element={<Private permission="payments.read"><PaymentsPage /></Private>} />
    <Route path="/finances" element={<Private permission="expenses.read"><FinancePage /></Private>} />
    <Route path="/utilisateurs" element={<Private permission="users.read"><UsersPage /></Private>} />
    <Route path="/journal" element={<Private permission="audit.read"><AuditPage /></Private>} />
    <Route path="/parametres" element={<Private permission="settings.read"><SettingsPage /></Private>} />
    <Route path="/interdit" element={<Private><ForbiddenPage /></Private>} />
    <Route path="*" element={<Private><NotFoundPage /></Private>} />
  </Routes></ConfirmProvider></ToastProvider></AppearanceProvider></AuthProvider></HashRouter>;
}
