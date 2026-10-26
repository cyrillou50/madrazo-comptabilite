import { useMemo, useState } from 'react';
import { FileClock, ShieldAlert } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import type { AuditLog } from '../types';
import { date } from '../lib/format';
import { listOf, metaOf } from '../lib/data';
import { Badge, ErrorState, LoadingState, PageHeader, Panel, SearchField, Select } from '../components/ui';
import { DataTable } from '../components/DataTable';

const actionLabels: Record<string, string> = {
  'auth.login_failed': 'Connexion refusée',
  'auth.login_succeeded': 'Connexion réussie',
  'auth.logout': 'Déconnexion',
  'expense.created': 'Dépense enregistrée',
  'expense.reversed': 'Dépense annulée',
  'group.created': 'Groupe créé',
  'group.updated': 'Groupe modifié',
  'group.archived': 'Groupe archivé',
  'contact.created': 'Contact créé',
  'contact.updated': 'Contact modifié',
  'contact.archived': 'Contact archivé',
  'item.created': 'Marchandise créée',
  'item.updated': 'Marchandise modifiée',
  'item.archived': 'Marchandise archivée',
  'order.created': 'Commande créée',
  'order.delivered': 'Livraison enregistrée',
  'order.cancelled': 'Commande annulée',
  'payment.created': 'Paiement enregistré',
  'payment.reversed': 'Paiement annulé',
  'setting.updated': 'Paramètre modifié',
  'settings.updated': 'Paramètres modifiés',
  'stock.movement_created': 'Mouvement de stock enregistré',
  'user.created': 'Utilisateur créé',
  'user.updated': 'Utilisateur modifié',
  'user.permissions_updated': 'Droits utilisateur modifiés',
  'user.status_updated': 'Statut utilisateur modifié',
  'role.created': 'Rôle créé',
  'role.updated': 'Rôle modifié',
  'role.archived': 'Rôle archivé',
  'category.created': 'Catégorie créée',
  'category.updated': 'Catégorie modifiée',
  'category.archived': 'Catégorie archivée',
};

const actionOptions = Object.entries(actionLabels).sort(([, first], [, second]) => first.localeCompare(second, 'fr'));

function actionLabel(action: string): string {
  return actionLabels[action.toLowerCase()] || 'Action enregistrée';
}

function actionTone(action: string): 'success' | 'warning' | 'danger' | 'neutral' | 'info' {
  const value = action.toLowerCase();
  if (value.includes('failed') || value.includes('cancel') || value.includes('reversed') || value.includes('archived')) return 'danger';
  if (value.includes('created') || value.includes('succeeded') || value.includes('delivered')) return 'success';
  if (value.includes('updated') || value.includes('movement')) return 'info';
  return 'neutral';
}

export function AuditPage() {
  const [search, setSearch] = useState(''); const [action, setAction] = useState(''); const [page, setPage] = useState(1);
  const query = useApi<any>('/audit-logs', { search, action, page, pageSize: 50 }); const logs = useMemo(() => listOf<AuditLog>(query.data), [query.data]); const meta = metaOf(query.data);
  return <div className="animate-enter"><PageHeader eyebrow="Traçabilité" title="Journal d’activité" description="Consultez les connexions et toutes les opérations sensibles sans altérer leur historique." />
    <Panel className="overflow-hidden"><div className="flex flex-col gap-3 border-b border-white/[.07] p-4 sm:flex-row"><SearchField value={search} onChange={(value) => { setSearch(value); setPage(1); }} placeholder="Utilisateur, entité ou adresse IP…" /><Select aria-label="Type d’action" value={action} onChange={(event) => { setAction(event.target.value); setPage(1); }} className="sm:w-64"><option value="">Toutes les actions</option>{actionOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></div>{query.loading ? <LoadingState /> : query.error ? <ErrorState message={query.error} retry={query.reload} /> : <DataTable<AuditLog> rows={logs} rowKey={(log) => log.id} page={meta?.page || page} totalPages={meta?.totalPages} onPage={setPage} columns={[
      { key: 'time', label: 'Date & heure', render: (log) => <div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-white/[.04] text-zinc-500">{String(log.action).toLowerCase().includes('failed') ? <ShieldAlert className="h-4 w-4 text-red-400" /> : <FileClock className="h-4 w-4" />}</span><span className="text-xs text-zinc-400">{date(log.createdAt, true)}</span></div> }, { key: 'user', label: 'Utilisateur', render: (log) => log.userName || 'Système' }, { key: 'action', label: 'Action', render: (log) => <Badge tone={actionTone(log.action)}>{actionLabel(log.action)}</Badge> }, { key: 'entity', label: 'Cible', render: (log) => <span className="font-mono text-xs text-zinc-500">{log.entityType ? `${log.entityType} #${log.entityId || '—'}` : '—'}</span> }, { key: 'ip', label: 'Adresse IP', render: (log) => <span className="font-mono text-xs text-zinc-600">{log.ipAddress || '—'}</span> },
    ]} />}</Panel>
  </div>;
}
