import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import {
  Bell, Boxes, CheckCircle2, ChevronDown, CircleDollarSign, ClipboardList, Clock3,
  ContactRound, FileClock, Gauge, HandCoins, LogOut, Menu, PackageSearch, PackageX,
  RefreshCw, Settings, ShieldCheck, UsersRound, X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../contexts/AuthContext';
import { currency, initials, number } from '../lib/format';
import { useApi } from '../hooks/useApi';
import type { DashboardData } from '../types';

interface NavigationItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  permission?: string;
}

interface NotificationItem {
  id: string;
  title: string;
  description: string;
  to: string;
  icon: LucideIcon;
  tone: 'danger' | 'warning';
}

const navigation: Array<{ label: string; items: NavigationItem[] }> = [
  { label: 'Vue d’ensemble', items: [
    { to: '/', label: 'Tableau de bord', icon: Gauge, end: true },
  ] },
  { label: 'Activité', items: [
    { to: '/ventes', label: 'Ventes', icon: ClipboardList },
    { to: '/groupes', label: 'Groupes', icon: UsersRound },
    { to: '/contacts', label: 'Contacts', icon: ContactRound },
  ] },
  { label: 'Opérations', items: [
    { to: '/catalogue', label: 'Marchandises', icon: PackageSearch },
    { to: '/stocks', label: 'Stocks', icon: Boxes },
    { to: '/paiements', label: 'Dettes & paiements', icon: HandCoins },
    { to: '/finances', label: 'Finances', icon: CircleDollarSign },
  ] },
  { label: 'Administration', items: [
    { to: '/utilisateurs', label: 'Utilisateurs', icon: ShieldCheck, permission: 'users.read' },
    { to: '/journal', label: 'Journal d’activité', icon: FileClock, permission: 'audit.read' },
    { to: '/parametres', label: 'Paramètres', icon: Settings, permission: 'settings.read' },
  ] },
];

const titles: Record<string, string> = {
  '/': 'Tableau de bord', '/ventes': 'Ventes', '/groupes': 'Groupes', '/contacts': 'Contacts',
  '/catalogue': 'Marchandises', '/stocks': 'Gestion des stocks', '/paiements': 'Dettes & paiements',
  '/finances': 'Finances', '/utilisateurs': 'Utilisateurs', '/journal': 'Journal d’activité', '/parametres': 'Paramètres',
};

function Brand() {
  return <div className="flex h-20 items-center gap-3 border-b border-white/[.06] px-5">
    <div className="relative grid h-10 w-10 place-items-center rounded-xl border border-blood-500/30 bg-gradient-to-br from-blood-600/30 to-ink-950 shadow-glow"><span className="font-display text-lg font-black text-white">M</span><span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border border-ink-900 bg-blood-400" /></div>
    <div><p className="font-display text-sm font-black tracking-[.22em] text-white">MADRAZO</p><p className="mt-0.5 text-[9px] font-semibold uppercase tracking-[.2em] text-zinc-600">Comptabilité</p></div>
  </div>;
}

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const menusRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const { user, logout, can } = useAuth();
  const notificationsQuery = useApi<DashboardData>('/dashboard');
  const currentTitle = titles[location.pathname] || 'MADRAZO';

  useEffect(() => {
    setOpen(false);
    setUserMenu(false);
    setNotificationsOpen(false);
  }, [location.pathname]);
  useEffect(() => {
    const interval = window.setInterval(notificationsQuery.reload, 60_000);
    return () => window.clearInterval(interval);
  }, [notificationsQuery.reload]);
  useEffect(() => {
    if (!notificationsOpen && !userMenu) return;
    const closeMenus = (event: PointerEvent) => {
      if (menusRef.current?.contains(event.target as Node)) return;
      setNotificationsOpen(false);
      setUserMenu(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setNotificationsOpen(false);
      setUserMenu(false);
    };
    document.addEventListener('pointerdown', closeMenus);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeMenus);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [notificationsOpen, userMenu]);
  const visibleNavigation = useMemo(() => navigation.map((group) => ({ ...group, items: group.items.filter((item) => !item.permission || can(item.permission)) })).filter((group) => group.items.length), [can]);
  const notifications = useMemo<NotificationItem[]>(() => {
    const dashboard = notificationsQuery.data;
    if (!dashboard) return [];
    const alerts: NotificationItem[] = [];
    if (dashboard.totals.lowStockItems > 0) {
      const names = dashboard.lowStock.slice(0, 2).map((item) => item.name).join(', ');
      alerts.push({ id: 'stock', title: `${number(dashboard.totals.lowStockItems)} stock${dashboard.totals.lowStockItems > 1 ? 's' : ''} à surveiller`, description: names || 'Des marchandises ont atteint leur seuil d’alerte.', to: '/stocks', icon: PackageX, tone: 'danger' });
    }
    if (dashboard.totals.pendingOrders > 0) {
      alerts.push({ id: 'orders', title: `${number(dashboard.totals.pendingOrders)} commande${dashboard.totals.pendingOrders > 1 ? 's' : ''} en attente`, description: 'Des commandes nécessitent encore un traitement.', to: '/ventes', icon: Clock3, tone: 'warning' });
    }
    if (dashboard.totals.outstandingDebt > 0) {
      alerts.push({ id: 'debts', title: 'Dettes à recouvrer', description: `${currency(dashboard.totals.outstandingDebt)} restent à encaisser.`, to: '/paiements', icon: HandCoins, tone: 'warning' });
    }
    return alerts;
  }, [notificationsQuery.data]);

  const sidebar = <>
    <Brand />
    <nav className="flex-1 overflow-y-auto px-3 py-5" aria-label="Navigation principale">
      {visibleNavigation.map((group) => <div key={group.label} className="mb-6">
        <p className="mb-2 px-3 text-[9px] font-bold uppercase tracking-[.22em] text-zinc-700">{group.label}</p>
        <div className="space-y-1">{group.items.map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end} className={({ isActive }) => clsx('group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition', isActive ? 'bg-blood-600/12 text-white' : 'text-zinc-500 hover:bg-white/[.035] hover:text-zinc-200')}>
          {({ isActive }) => <><span className={clsx('absolute inset-y-2 left-0 w-0.5 rounded-full bg-blood-500 transition-opacity', isActive ? 'opacity-100' : 'opacity-0')} /><Icon className={clsx('h-[18px] w-[18px] transition', isActive ? 'text-blood-400' : 'text-zinc-600 group-hover:text-zinc-400')} /><span>{label}</span></>}
        </NavLink>)}</div>
      </div>)}
    </nav>
    <div className="border-t border-white/[.06] p-3"><div className="flex items-center gap-3 rounded-xl bg-white/[.025] p-3"><div className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-lg bg-gradient-to-br from-blood-600 to-blood-900 text-xs font-bold text-white">{user?.avatarUrl ? <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" /> : initials(user?.displayName)}</div><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-zinc-200">{user?.displayName}</p><p className="truncate text-[10px] uppercase tracking-wider text-zinc-600">{user?.role}</p></div><button onClick={() => void logout()} className="rounded-lg p-2 text-zinc-600 hover:bg-white/[.06] hover:text-red-400" aria-label="Se déconnecter"><LogOut className="h-4 w-4" /></button></div></div>
  </>;

  return <div className="min-h-screen bg-ink-950 text-zinc-100 subtle-grid">
    <aside className="fixed inset-y-0 left-0 z-50 hidden w-64 flex-col border-r border-white/[.06] bg-ink-900/95 backdrop-blur lg:flex">{sidebar}</aside>
    {open && <div className="fixed inset-0 z-[60] lg:hidden"><button className="absolute inset-0 bg-black/75" onClick={() => setOpen(false)} aria-label="Fermer le menu" /><aside className="absolute inset-y-0 left-0 flex w-[min(290px,88vw)] flex-col border-r border-white/10 bg-ink-900 shadow-2xl"><button onClick={() => setOpen(false)} className="absolute right-3 top-6 z-10 rounded-lg p-2 text-zinc-500 hover:bg-white/5 hover:text-white" aria-label="Fermer"><X className="h-5 w-5" /></button>{sidebar}</aside></div>}
    <div className="lg:pl-64">
      <header className="sticky top-0 z-40 flex h-16 items-center border-b border-white/[.06] bg-ink-950/85 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
        <button onClick={() => setOpen(true)} className="mr-3 rounded-lg p-2 text-zinc-500 hover:bg-white/5 hover:text-white lg:hidden" aria-label="Ouvrir le menu"><Menu className="h-5 w-5" /></button>
        <div className="min-w-0"><p className="truncate text-sm font-semibold text-zinc-200">{currentTitle}</p><div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-zinc-600"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Session sécurisée</div></div>
        <div ref={menusRef} className="ml-auto flex items-center gap-2">
          <div className="relative">
            <button type="button" onClick={() => { setNotificationsOpen((value) => !value); setUserMenu(false); }} className="relative rounded-xl border border-white/[.06] bg-white/[.025] p-2.5 text-zinc-500 transition hover:bg-white/[.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blood-400" aria-label={notifications.length ? `Notifications, ${notifications.length} alerte${notifications.length > 1 ? 's' : ''}` : 'Notifications'} aria-expanded={notificationsOpen} aria-controls="notifications-panel">
              <Bell className="h-4 w-4" />
              {notifications.length > 0 && <span className="absolute -right-1.5 -top-1.5 grid min-h-4 min-w-4 place-items-center rounded-full bg-blood-500 px-1 text-[9px] font-black leading-none text-white ring-2 ring-ink-950">{notifications.length}</span>}
            </button>
            {notificationsOpen && <section id="notifications-panel" aria-label="Centre de notifications" className="fixed left-4 right-4 top-[4.5rem] overflow-hidden rounded-2xl border border-white/10 bg-ink-850 shadow-2xl sm:absolute sm:left-auto sm:right-0 sm:top-12 sm:w-96">
              <header className="flex items-center justify-between border-b border-white/[.07] px-4 py-3.5">
                <div><h2 className="text-sm font-bold text-zinc-100">Notifications</h2><p className="mt-0.5 text-[10px] text-zinc-600">Alertes synchronisées avec l’activité</p></div>
                <button type="button" onClick={notificationsQuery.reload} disabled={notificationsQuery.loading} className="rounded-lg p-2 text-zinc-600 transition hover:bg-white/[.05] hover:text-white disabled:opacity-50" aria-label="Actualiser les notifications"><RefreshCw className={clsx('h-4 w-4', notificationsQuery.loading && 'animate-spin')} /></button>
              </header>
              <div className="max-h-[min(420px,calc(100dvh-9rem))] overflow-y-auto">
                {notificationsQuery.loading && !notificationsQuery.data ? <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-zinc-600"><RefreshCw className="h-4 w-4 animate-spin" />Chargement des alertes…</div>
                  : notificationsQuery.error ? <div className="px-5 py-8 text-center"><p className="text-sm font-semibold text-red-300">Alertes indisponibles</p><p className="mt-1 text-xs text-zinc-600">{notificationsQuery.error}</p><button type="button" onClick={notificationsQuery.reload} className="mt-3 text-xs font-semibold text-blood-400 hover:text-blood-300">Réessayer</button></div>
                    : notifications.length ? <div className="divide-y divide-white/[.055]">{notifications.map((notification) => {
                      const Icon = notification.icon;
                      return <Link key={notification.id} to={notification.to} onClick={() => setNotificationsOpen(false)} className="group flex gap-3 px-4 py-3.5 transition hover:bg-white/[.035]"><span className={clsx('mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl', notification.tone === 'danger' ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-400')}><Icon className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-zinc-200 group-hover:text-white">{notification.title}</span><span className="mt-0.5 block text-xs leading-relaxed text-zinc-600">{notification.description}</span></span></Link>;
                    })}</div>
                      : <div className="px-5 py-10 text-center"><span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-emerald-500/10 text-emerald-400"><CheckCircle2 className="h-5 w-5" /></span><p className="mt-3 text-sm font-semibold text-zinc-300">Tout est à jour</p><p className="mt-1 text-xs text-zinc-600">Aucune alerte opérationnelle.</p></div>}
              </div>
            </section>}
          </div>
          <div className="relative"><button type="button" onClick={() => { setUserMenu((value) => !value); setNotificationsOpen(false); }} className="flex items-center gap-2 rounded-xl border border-white/[.06] bg-white/[.025] py-1.5 pl-1.5 pr-2.5 transition hover:bg-white/[.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blood-400" aria-label="Ouvrir le menu utilisateur" aria-expanded={userMenu}><span className="grid h-7 w-7 place-items-center rounded-lg bg-blood-700 text-[10px] font-bold">{initials(user?.displayName)}</span><span className="hidden text-xs font-semibold text-zinc-300 sm:block">{user?.displayName}</span><ChevronDown className="h-3.5 w-3.5 text-zinc-600" /></button>{userMenu && <div className="absolute right-0 top-12 w-48 rounded-xl border border-white/10 bg-ink-850 p-1.5 shadow-2xl"><div className="border-b border-white/[.06] px-3 py-2"><p className="text-xs font-semibold text-zinc-200">{user?.displayName}</p><p className="text-[10px] text-zinc-600">{user?.role}</p></div><button type="button" onClick={() => void logout()} className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-zinc-400 hover:bg-red-500/10 hover:text-red-300"><LogOut className="h-4 w-4" />Déconnexion</button></div>}</div>
        </div>
      </header>
      <main className="mx-auto max-w-[1600px] p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  </div>;
}
