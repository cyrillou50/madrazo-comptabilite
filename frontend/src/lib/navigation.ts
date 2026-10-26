import {
  Boxes, CircleDollarSign, ClipboardList, ContactRound, FileClock, Gauge, HandCoins,
  PackageSearch, Settings, ShieldCheck, UsersRound, type LucideIcon,
} from 'lucide-react';

export interface NavigationItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  permission: string;
}

// Chaque rubrique n'apparaît que si le rôle de l'utilisateur permet de la consulter.
export const navigation: Array<{ label: string; items: NavigationItem[] }> = [
  { label: 'Vue d’ensemble', items: [
    { to: '/', label: 'Tableau de bord', icon: Gauge, end: true, permission: 'dashboard.read' },
  ] },
  { label: 'Activité', items: [
    { to: '/ventes', label: 'Ventes', icon: ClipboardList, permission: 'orders.read' },
    { to: '/groupes', label: 'Groupes', icon: UsersRound, permission: 'groups.read' },
    { to: '/contacts', label: 'Contacts', icon: ContactRound, permission: 'contacts.read' },
  ] },
  { label: 'Opérations', items: [
    { to: '/catalogue', label: 'Marchandises', icon: PackageSearch, permission: 'catalog.read' },
    { to: '/stocks', label: 'Stocks', icon: Boxes, permission: 'stocks.read' },
    { to: '/paiements', label: 'Dettes & paiements', icon: HandCoins, permission: 'payments.read' },
    { to: '/finances', label: 'Finances', icon: CircleDollarSign, permission: 'expenses.read' },
  ] },
  { label: 'Administration', items: [
    { to: '/utilisateurs', label: 'Utilisateurs', icon: ShieldCheck, permission: 'users.read' },
    { to: '/journal', label: 'Journal d’activité', icon: FileClock, permission: 'audit.read' },
    { to: '/parametres', label: 'Paramètres', icon: Settings, permission: 'settings.read' },
  ] },
];

export function firstAllowedPath(can: (permission: string) => boolean): string | null {
  for (const group of navigation) for (const item of group.items) if (can(item.permission)) return item.to;
  return null;
}
