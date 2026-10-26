import { useMemo, useState } from 'react';
import { FileClock, ShieldAlert } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import type { AuditLog } from '../types';
import { date } from '../lib/format';
import { listOf, metaOf } from '../lib/data';
import { actionOptions, describeActivity, describeFields } from '../lib/activity';
import { Badge, ErrorState, LoadingState, Modal, PageHeader, Panel, SearchField, Select } from '../components/ui';
import { DataTable } from '../components/DataTable';
import { useAuth } from '../contexts/AuthContext';

function FieldList({ title, fields }: { title: string; fields: Array<{ label: string; value: string }> }) {
  if (!fields.length) return null;
  return <div className="rounded-xl border border-white/[.07] bg-white/[.02] p-4"><p className="label">{title}</p><dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[minmax(0,180px)_minmax(0,1fr)]">{fields.map((field) => <div key={field.label} className="contents"><dt className="text-zinc-600">{field.label}</dt><dd className="break-words text-zinc-300">{field.value}</dd></div>)}</dl></div>;
}

export function AuditPage() {
  const [search, setSearch] = useState(''); const [action, setAction] = useState(''); const [page, setPage] = useState(1); const [selected, setSelected] = useState<AuditLog | null>(null);
  const { preferences } = useAuth();
  const query = useApi<any>('/audit-logs', { search, action, page, pageSize: preferences.defaultPageSize }); const logs = useMemo(() => listOf<AuditLog>(query.data), [query.data]); const meta = metaOf(query.data);
  const selectedDescription = selected ? describeActivity(selected) : null;
  return <div className="animate-enter"><PageHeader eyebrow="Traçabilité" title="Journal d’activité" description="Consultez les connexions et toutes les opérations sensibles sans altérer leur historique." />
    <Panel className="overflow-hidden"><div className="flex flex-col gap-3 border-b border-white/[.07] p-4 sm:flex-row"><SearchField value={search} onChange={(value) => { setSearch(value); setPage(1); }} placeholder="Utilisateur, référence, nom ou adresse IP…" /><Select aria-label="Type d’action" value={action} onChange={(event) => { setAction(event.target.value); setPage(1); }} className="sm:w-72"><option value="">Toutes les actions</option>{actionOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</Select><span className="ml-auto self-center text-xs text-zinc-600">{meta?.total ?? logs.length} entrée(s)</span></div>{query.loading ? <LoadingState /> : query.error ? <ErrorState message={query.error} retry={query.reload} /> : <DataTable<AuditLog> rows={logs} rowKey={(log) => log.id} page={meta?.page || page} totalPages={meta?.totalPages} onPage={setPage} onRowClick={setSelected} emptyTitle="Aucune activité" emptyDescription="Aucune entrée ne correspond à ces filtres." columns={[
      { key: 'time', label: 'Date & heure', render: (log) => <div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-white/[.04] text-zinc-500">{log.action.includes('failed') ? <ShieldAlert className="h-4 w-4 text-red-400" /> : <FileClock className="h-4 w-4" />}</span><span className="whitespace-nowrap text-xs text-zinc-400">{date(log.createdAt, true)}</span></div> },
      { key: 'user', label: 'Utilisateur', render: (log) => <div><p className="text-zinc-300">{log.userName || 'Système'}</p>{log.actorUsername && <p className="text-[11px] text-zinc-600">{log.actorUsername}</p>}</div> },
      { key: 'action', label: 'Action', render: (log) => { const description = describeActivity(log); return <div className="max-w-md"><Badge tone={description.tone}>{description.label}</Badge>{description.detail && <p className="mt-1.5 truncate text-xs text-zinc-500">{description.detail}</p>}</div>; } },
      { key: 'entity', label: 'Élément concerné', render: (log) => <span className="text-xs text-zinc-400">{describeActivity(log).target}</span> },
      { key: 'ip', label: 'Adresse IP', render: (log) => <span className="font-mono text-xs text-zinc-600">{log.ipAddress || '—'}</span> },
    ]} />}</Panel>
    <Modal open={!!selected} onClose={() => setSelected(null)} title={selectedDescription?.label || 'Détail'} description={selected ? `${selected.userName || 'Système'} ${selectedDescription?.sentence ?? ''}` : undefined} size="lg"><div className="space-y-3 p-5">
      <div className="grid gap-3 text-sm sm:grid-cols-3"><div className="rounded-xl bg-white/[.03] p-3"><p className="label">Date</p><p className="text-zinc-300">{date(selected?.createdAt, true)}</p></div><div className="rounded-xl bg-white/[.03] p-3"><p className="label">Élément</p><p className="text-zinc-300">{selectedDescription?.target}</p></div><div className="rounded-xl bg-white/[.03] p-3"><p className="label">Adresse IP</p><p className="font-mono text-xs text-zinc-400">{selected?.ipAddress || '—'}</p></div></div>
      <FieldList title="Avant" fields={describeFields(selected?.beforeData)} />
      <FieldList title={selected?.beforeData ? 'Après' : 'Informations'} fields={describeFields(selected?.afterData)} />
      {selected && !describeFields(selected.beforeData).length && !describeFields(selected.afterData).length && <p className="text-sm text-zinc-600">Aucun détail supplémentaire n’a été enregistré pour cette action.</p>}
    </div></Modal>
  </div>;
}
