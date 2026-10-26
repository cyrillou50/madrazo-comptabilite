import { useMemo, useState } from 'react';
import { FileClock, ShieldAlert } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import type { AuditLog } from '../types';
import { date } from '../lib/format';
import { listOf, metaOf } from '../lib/data';
import { Badge, ErrorState, LoadingState, PageHeader, Panel, SearchField, Select } from '../components/ui';
import { DataTable } from '../components/DataTable';

export function AuditPage() {
  const [search, setSearch] = useState(''); const [action, setAction] = useState(''); const [page, setPage] = useState(1);
  const query = useApi<any>('/audit-logs', { search, action, page, pageSize: 50 }); const logs = useMemo(() => listOf<AuditLog>(query.data), [query.data]); const meta = metaOf(query.data);
  return <div className="animate-enter"><PageHeader eyebrow="Traçabilité" title="Journal d’activité" description="Consultez les connexions et toutes les opérations sensibles sans altérer leur historique." />
    <Panel className="overflow-hidden"><div className="flex flex-col gap-3 border-b border-white/[.07] p-4 sm:flex-row"><SearchField value={search} onChange={setSearch} placeholder="Utilisateur, entité ou adresse IP…" /><Select aria-label="Type d’action" value={action} onChange={(e) => setAction(e.target.value)} className="sm:w-56"><option value="">Toutes les actions</option><option value="LOGIN">Connexions</option><option value="CREATE">Créations</option><option value="UPDATE">Modifications</option><option value="DELETE">Archivages</option><option value="PAYMENT">Paiements</option><option value="STOCK">Stocks</option></Select></div>{query.loading ? <LoadingState /> : query.error ? <ErrorState message={query.error} retry={query.reload} /> : <DataTable<AuditLog> rows={logs} rowKey={(log) => log.id} page={meta?.page || page} totalPages={meta?.totalPages} onPage={setPage} columns={[
      { key: 'time', label: 'Date & heure', render: (log) => <div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-white/[.04] text-zinc-500">{String(log.action).includes('FAIL') ? <ShieldAlert className="h-4 w-4 text-red-400" /> : <FileClock className="h-4 w-4" />}</span><span className="text-xs text-zinc-400">{date(log.createdAt, true)}</span></div> }, { key: 'user', label: 'Utilisateur', render: (log) => log.userName || 'Système' }, { key: 'action', label: 'Action', render: (log) => <Badge>{log.action}</Badge> }, { key: 'entity', label: 'Cible', render: (log) => <span className="font-mono text-xs text-zinc-500">{log.entityType ? `${log.entityType} #${log.entityId || '—'}` : '—'}</span> }, { key: 'ip', label: 'Adresse IP', render: (log) => <span className="font-mono text-xs text-zinc-600">{log.ipAddress || '—'}</span> },
    ]} />}</Panel>
  </div>;
}
