import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Activity, Bell, CheckCircle2, ChevronDown, Clock3, HandCoins, KeyRound, LogOut, Menu, PackageX, RefreshCw, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { api, ApiError } from '../lib/api';
import { describeActivity } from '../lib/activity';
import { currency, initials, number, relativeTime } from '../lib/format';
import { useApi } from '../hooks/useApi';
import { navigation } from '../lib/navigation';
import type { NotificationAlert, NotificationsData } from '../types';
import { FormActions, Input, Modal } from './ui';

const titles: Record<string, string> = {
  '/': 'Tableau de bord', '/ventes': 'Ventes', '/groupes': 'Groupes', '/contacts': 'Contacts',
  '/catalogue': 'Marchandises', '/stocks': 'Gestion des stocks', '/paiements': 'Dettes & paiements',
  '/finances': 'Finances', '/utilisateurs': 'Utilisateurs', '/journal': 'Journal d’activité', '/parametres': 'Paramètres',
};

function Brand({ name }: { name: string }) {
  return <div className="flex h-20 items-center gap-3 border-b border-white/[.06] px-5">
    <div className="relative grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-blood-500/30 bg-gradient-to-br from-blood-600/30 to-ink-950 shadow-glow"><span className="font-display text-lg font-black text-white">{initials(name).charAt(0) || 'M'}</span><span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border border-ink-900 bg-blood-400" /></div>
    <div className="min-w-0"><p className="truncate font-display text-sm font-black uppercase tracking-[.22em] text-white">{name}</p><p className="mt-0.5 text-[9px] font-semibold uppercase tracking-[.2em] text-zinc-600">Comptabilité</p></div>
  </div>;
}

function alertContent(alert: NotificationAlert): { title: string; description: string; to: string; icon: LucideIcon; tone: 'danger' | 'warning' } {
  if (alert.id === 'stock') {
    const outOfStock = alert.outOfStock ? ` dont ${number(alert.outOfStock)} en rupture` : '';
    return { title: `${number(alert.count)} marchandise${alert.count > 1 ? 's' : ''} sous le seuil${outOfStock}`, description: alert.names?.join(', ') || 'Des marchandises doivent être réapprovisionnées.', to: '/stocks', icon: PackageX, tone: 'danger' };
  }
  if (alert.id === 'orders') {
    return { title: `${number(alert.count)} vente${alert.count > 1 ? 's' : ''} à traiter`, description: 'En attente, confirmées ou partiellement livrées.', to: '/ventes', icon: Clock3, tone: 'warning' };
  }
  return { title: `${number(alert.count)} dette${alert.count > 1 ? 's' : ''} de plus de ${number(alert.days ?? 30)} jours`, description: `${currency(alert.remainingAmount ?? 0)} restent à encaisser.`, to: '/paiements', icon: HandCoins, tone: 'warning' };
}

function NotificationCenter({ onNavigate }: { onNavigate: () => void }) {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState<Set<string>>(new Set());
  const query = useApi<NotificationsData>('/notifications');
  const { can } = useAuth();
  const { reload } = query;
  const data = query.data;
  const unread = data?.unreadCount ?? 0;

  useEffect(() => {
    const interval = window.setInterval(reload, 60_000);
    const onVisible = () => { if (document.visibilityState === 'visible') reload(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { window.clearInterval(interval); document.removeEventListener('visibilitychange', onVisible); };
  }, [reload]);

  const toggle = useCallback(async () => {
    const next = !open;
    setOpen(next);
    if (!next || !data || !data.unreadCount) return;
    // À l'ouverture, les éléments non lus restent signalés pendant la consultation puis le compteur repart à zéro.
    setHighlighted(new Set([...data.alerts.filter((alert) => alert.unread).map((alert) => `alert-${alert.id}`), ...data.events.filter((event) => event.unread).map((event) => `event-${event.id}`)]));
    try { await api.post('/notifications/read'); reload(); } catch { /* l'état non lu sera simplement conservé */ }
  }, [open, data, reload]);

  useEffect(() => {
    if (!open) return;
    const close = (event: Event) => {
      if (event.type === 'keydown' && (event as KeyboardEvent).key !== 'Escape') return;
      if (event.type === 'pointerdown' && (event.target as HTMLElement | null)?.closest?.('[data-notifications]')) return;
      setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', close); };
  }, [open]);

  const close = () => { setOpen(false); onNavigate(); };
  const alerts = data?.alerts ?? [];
  const events = data?.events ?? [];

  return <div className="relative" data-notifications>
    <button type="button" onClick={() => void toggle()} className="relative rounded-xl border border-white/[.06] bg-white/[.025] p-2.5 text-zinc-500 transition hover:bg-white/[.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blood-400" aria-label={unread ? `Notifications, ${unread} non lue${unread > 1 ? 's' : ''}` : 'Notifications'} aria-expanded={open} aria-controls="notifications-panel">
      <Bell className="h-4 w-4" />
      {unread > 0 && <span className="absolute -right-1.5 -top-1.5 grid min-h-4 min-w-4 place-items-center rounded-full bg-blood-500 px-1 text-[9px] font-black leading-none text-white ring-2 ring-ink-950">{unread > 9 ? '9+' : unread}</span>}
    </button>
    {open && <section id="notifications-panel" aria-label="Centre de notifications" className="fixed left-4 right-4 top-[4.5rem] z-50 overflow-hidden rounded-2xl border border-white/10 bg-ink-850 shadow-2xl sm:absolute sm:left-auto sm:right-0 sm:top-12 sm:w-[400px]">
      <header className="flex items-center justify-between border-b border-white/[.07] px-4 py-3.5">
        <div><h2 className="text-sm font-bold text-zinc-100">Notifications</h2><p className="mt-0.5 text-[10px] text-zinc-600">Alertes et activité de l’équipe, selon vos droits</p></div>
        <button type="button" onClick={reload} disabled={query.loading} className="rounded-lg p-2 text-zinc-600 transition hover:bg-white/[.05] hover:text-white disabled:opacity-50" aria-label="Actualiser les notifications"><RefreshCw className={clsx('h-4 w-4', query.loading && 'animate-spin')} /></button>
      </header>
      <div className="max-h-[min(480px,calc(100dvh-9rem))] overflow-y-auto">
        {query.loading && !data ? <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-zinc-600"><RefreshCw className="h-4 w-4 animate-spin" />Chargement…</div>
          : query.error && !data ? <div className="px-5 py-8 text-center"><p className="text-sm font-semibold text-red-300">Notifications indisponibles</p><p className="mt-1 text-xs text-zinc-600">{query.error}</p><button type="button" onClick={reload} className="mt-3 text-xs font-semibold text-blood-400 hover:text-blood-300">Réessayer</button></div>
            : !alerts.length && !events.length ? <div className="px-5 py-10 text-center"><span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-emerald-500/10 text-emerald-400"><CheckCircle2 className="h-5 w-5" /></span><p className="mt-3 text-sm font-semibold text-zinc-300">Tout est à jour</p><p className="mt-1 text-xs text-zinc-600">Aucune alerte ni nouvelle activité.</p></div>
              : <>
                {alerts.length > 0 && <div><p className="px-4 pb-1 pt-3 text-[10px] font-bold uppercase tracking-[.18em] text-zinc-600">À traiter</p><div className="divide-y divide-white/[.055]">{alerts.map((alert) => {
                  const content = alertContent(alert); const Icon = content.icon; const isNew = highlighted.has(`alert-${alert.id}`);
                  return <Link key={alert.id} to={content.to} onClick={close} className="group flex gap-3 px-4 py-3.5 transition hover:bg-white/[.035]"><span className={clsx('mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl', content.tone === 'danger' ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-400')}><Icon className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="flex items-center gap-2 text-sm font-semibold text-zinc-200 group-hover:text-white">{content.title}{isNew && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-blood-400" aria-label="nouveau" />}</span><span className="mt-0.5 block truncate text-xs text-zinc-600">{content.description}</span></span></Link>;
                })}</div></div>}
                {events.length > 0 && <div><p className="px-4 pb-1 pt-3 text-[10px] font-bold uppercase tracking-[.18em] text-zinc-600">Activité récente</p><div className="divide-y divide-white/[.055]">{events.map((event) => {
                  const description = describeActivity(event); const isNew = highlighted.has(`event-${event.id}`);
                  return <Link key={event.id} to={description.to || '/'} onClick={close} className={clsx('group flex gap-3 px-4 py-3 transition hover:bg-white/[.035]', isNew && 'bg-blood-500/[.04]')}><span className={clsx('mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg', description.tone === 'danger' ? 'bg-red-500/10 text-red-400' : description.tone === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-sky-500/10 text-sky-400')}><Activity className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block text-[13px] leading-snug text-zinc-400"><span className="font-semibold text-zinc-200">{event.userName || 'Système'}</span> {description.sentence}</span><span className="mt-1 flex items-center gap-2 text-[10px] text-zinc-600">{relativeTime(event.createdAt)}{isNew && <span className="rounded-full bg-blood-500/15 px-1.5 py-0.5 font-bold uppercase tracking-wider text-blood-300">Nouveau</span>}</span></span></Link>;
                })}</div></div>}
              </>}
      </div>
      {can('audit.read') && <footer className="border-t border-white/[.07] px-4 py-2.5 text-right"><Link to="/journal" onClick={close} className="text-xs font-semibold text-blood-400 hover:text-blood-300">Ouvrir le journal d’activité</Link></footer>}
    </section>}
  </div>;
}

function PasswordDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { changePassword } = useAuth();
  const { notify } = useToast();

  useEffect(() => { if (!open) { setCurrent(''); setNext(''); setConfirmation(''); setError(null); } }, [open]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (next.length < 12) { setError('Le nouveau mot de passe doit contenir au moins 12 caractères.'); return; }
    if (next !== confirmation) { setError('La confirmation ne correspond pas au nouveau mot de passe.'); return; }
    setSaving(true);
    try { await changePassword(current, next); notify('Mot de passe modifié. Vos autres sessions ont été fermées.'); onClose(); }
    catch (reason) { setError(reason instanceof ApiError ? reason.message : 'Changement impossible.'); }
    finally { setSaving(false); }
  }

  return <Modal open={open} onClose={onClose} title="Changer mon mot de passe" description="Choisissez un mot de passe d’au moins 12 caractères." size="sm">
    <form onSubmit={submit} className="space-y-4 p-5">
      <Input label="Mot de passe actuel" type="password" autoComplete="current-password" value={current} onChange={(event) => setCurrent(event.target.value)} required autoFocus />
      <Input label="Nouveau mot de passe" type="password" autoComplete="new-password" value={next} onChange={(event) => setNext(event.target.value)} required />
      <Input label="Confirmer le nouveau mot de passe" type="password" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required />
      {error && <p role="alert" className="rounded-xl border border-red-500/20 bg-red-500/[.07] px-3.5 py-3 text-sm text-red-300">{error}</p>}
      <FormActions cancel={onClose} submitting={saving} submitLabel="Changer le mot de passe" />
    </form>
  </Modal>;
}

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const { user, logout, can, preferences } = useAuth();
  const currentTitle = titles[location.pathname] || preferences.organizationName;

  useEffect(() => { setOpen(false); setUserMenu(false); }, [location.pathname]);
  useEffect(() => { document.title = `${preferences.organizationName} — Comptabilité`; }, [preferences.organizationName]);
  useEffect(() => {
    if (!userMenu) return;
    const closeMenu = (event: Event) => {
      if (event.type === 'keydown' && (event as KeyboardEvent).key !== 'Escape') return;
      if (event.type === 'pointerdown' && userMenuRef.current?.contains(event.target as Node)) return;
      setUserMenu(false);
    };
    document.addEventListener('pointerdown', closeMenu);
    document.addEventListener('keydown', closeMenu);
    return () => { document.removeEventListener('pointerdown', closeMenu); document.removeEventListener('keydown', closeMenu); };
  }, [userMenu]);
  const visibleNavigation = useMemo(() => navigation.map((group) => ({ ...group, items: group.items.filter((item) => can(item.permission)) })).filter((group) => group.items.length), [can]);

  const sidebar = <>
    <Brand name={preferences.organizationName} />
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
          <NotificationCenter onNavigate={() => setUserMenu(false)} />
          <div ref={userMenuRef} className="relative"><button type="button" onClick={() => setUserMenu((value) => !value)} className="flex items-center gap-2 rounded-xl border border-white/[.06] bg-white/[.025] py-1.5 pl-1.5 pr-2.5 transition hover:bg-white/[.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blood-400" aria-label="Ouvrir le menu utilisateur" aria-expanded={userMenu}><span className="grid h-7 w-7 place-items-center rounded-lg bg-blood-700 text-[10px] font-bold">{initials(user?.displayName)}</span><span className="hidden text-xs font-semibold text-zinc-300 sm:block">{user?.displayName}</span><ChevronDown className="h-3.5 w-3.5 text-zinc-600" /></button>{userMenu && <div className="absolute right-0 top-12 z-50 w-56 rounded-xl border border-white/10 bg-ink-850 p-1.5 shadow-2xl"><div className="border-b border-white/[.06] px-3 py-2"><p className="truncate text-xs font-semibold text-zinc-200">{user?.displayName}</p><p className="truncate text-[10px] text-zinc-600">{user?.username ? `@${user.username} · ` : ''}{user?.role}</p></div><button type="button" onClick={() => { setUserMenu(false); setPasswordOpen(true); }} className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-zinc-400 hover:bg-white/[.06] hover:text-white"><KeyRound className="h-4 w-4" />Changer mon mot de passe</button><button type="button" onClick={() => void logout()} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-zinc-400 hover:bg-red-500/10 hover:text-red-300"><LogOut className="h-4 w-4" />Déconnexion</button></div>}</div>
        </div>
      </header>
      <main className="mx-auto max-w-[1600px] p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
    <PasswordDialog open={passwordOpen} onClose={() => setPasswordOpen(false)} />
  </div>;
}
