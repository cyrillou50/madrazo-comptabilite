import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Bell, Boxes, ChevronDown, CircleDollarSign, ClipboardList, ContactRound, FileClock,
  Gauge, HandCoins, LogOut, Menu, PackageSearch, Settings, ShieldCheck, UsersRound, X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../contexts/AuthContext';
import { initials } from '../lib/format';

interface NavigationItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  permission?: string;
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
  const location = useLocation();
  const { user, logout, can } = useAuth();
  const currentTitle = titles[location.pathname] || 'MADRAZO';

  useEffect(() => setOpen(false), [location.pathname]);
  const visibleNavigation = useMemo(() => navigation.map((group) => ({ ...group, items: group.items.filter((item) => !item.permission || can(item.permission)) })).filter((group) => group.items.length), [can]);

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
        <div className="ml-auto flex items-center gap-2">
          <button className="relative rounded-xl border border-white/[.06] bg-white/[.025] p-2.5 text-zinc-500 transition hover:bg-white/[.06] hover:text-white" aria-label="Notifications"><Bell className="h-4 w-4" /><span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-blood-400 ring-2 ring-ink-950" /></button>
          <div className="relative"><button onClick={() => setUserMenu((v) => !v)} className="flex items-center gap-2 rounded-xl border border-white/[.06] bg-white/[.025] py-1.5 pl-1.5 pr-2.5 transition hover:bg-white/[.06]" aria-expanded={userMenu}><span className="grid h-7 w-7 place-items-center rounded-lg bg-blood-700 text-[10px] font-bold">{initials(user?.displayName)}</span><span className="hidden text-xs font-semibold text-zinc-300 sm:block">{user?.displayName}</span><ChevronDown className="h-3.5 w-3.5 text-zinc-600" /></button>{userMenu && <div className="absolute right-0 top-12 w-48 rounded-xl border border-white/10 bg-ink-850 p-1.5 shadow-2xl"><div className="border-b border-white/[.06] px-3 py-2"><p className="text-xs font-semibold text-zinc-200">{user?.displayName}</p><p className="text-[10px] text-zinc-600">{user?.role}</p></div><button onClick={() => void logout()} className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-zinc-400 hover:bg-red-500/10 hover:text-red-300"><LogOut className="h-4 w-4" />Déconnexion</button></div>}</div>
        </div>
      </header>
      <main className="mx-auto max-w-[1600px] p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  </div>;
}
