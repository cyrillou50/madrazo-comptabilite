import { useMemo, useState } from 'react';
import { Archive, Eye, Pencil, Plus, UsersRound } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api, ApiError } from '../lib/api';
import { useApi } from '../hooks/useApi';
import type { Group } from '../types';
import { currency, date } from '../lib/format';
import { listOf, metaOf } from '../lib/data';
import { Badge, Button, ErrorState, FormActions, Input, LoadingState, Modal, PageHeader, Panel, SearchField, Select, Textarea } from '../components/ui';
import { DataTable } from '../components/DataTable';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';

const schema = z.object({
  name: z.string().min(2, 'Le nom est obligatoire.'),
  type: z.string().min(1), manager: z.string().optional(), phone: z.string().optional(),
  status: z.string().min(1), description: z.string().optional(), notes: z.string().optional(),
});
type FormData = z.infer<typeof schema>;
const defaults: FormData = { name: '', type: 'organisation', manager: '', phone: '', status: 'Actif', description: '', notes: '' };

export function GroupsPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Group | null | undefined>(undefined);
  const [details, setDetails] = useState<Group | null>(null);
  const { data, loading, error, reload } = useApi<any>('/groups', { search, status, page, pageSize: 20 });
  const rows = useMemo(() => listOf<Group>(data), [data]);
  const meta = metaOf(data);
  const { notify } = useToast();
  const { can } = useAuth();
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: defaults });

  function openForm(group: Group | null) {
    setEditing(group);
    reset(group ? { name: group.name, type: group.type, manager: group.manager || '', phone: group.phone || '', status: group.status, description: group.description || '', notes: group.notes || '' } : defaults);
  }
  async function submit(values: FormData) {
    try {
      const payload = { ...values, manager: undefined, notes: undefined, managerName: values.manager, internalNotes: values.notes };
      if (editing) await api.put(`/groups/${editing.id}`, payload); else await api.post('/groups', payload);
      notify(editing ? 'Groupe mis à jour.' : 'Groupe créé.'); setEditing(undefined); reload();
    } catch (reason) { notify(reason instanceof ApiError ? reason.message : 'Enregistrement impossible.', 'error'); }
  }
  async function archive(group: Group) {
    if (!window.confirm(`Archiver « ${group.name} » ? Son historique sera conservé.`)) return;
    try { await api.post(`/groups/${group.id}/archive`); notify('Groupe archivé.'); reload(); }
    catch (reason) { notify(reason instanceof ApiError ? reason.message : 'Archivage impossible.', 'error'); }
  }

  return <div className="animate-enter"><PageHeader eyebrow="Relations commerciales" title="Groupes" description="Centralisez les acheteurs, leurs conditions tarifaires, leurs contacts et leurs dettes." action={can('groups.create') ? <Button onClick={() => openForm(null)}><Plus className="h-4 w-4" />Nouveau groupe</Button> : undefined} />
    <Panel className="overflow-hidden"><div className="flex flex-col gap-3 border-b border-white/[.07] p-4 sm:flex-row sm:items-center"><SearchField value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Nom, responsable ou téléphone…" /><Select aria-label="Filtrer par statut" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="sm:w-52"><option value="">Tous les statuts</option>{['Actif','Acheteur régulier','Acheteur occasionnel','VIP','Sous surveillance','Black-listé','Inactif'].map((x) => <option key={x}>{x}</option>)}</Select><span className="ml-auto text-xs text-zinc-600">{meta?.total ?? rows.length} groupe(s)</span></div>
      {loading ? <LoadingState /> : error ? <ErrorState message={error} retry={reload} /> : <DataTable<Group> rows={rows} rowKey={(g) => g.id} page={meta?.page || page} totalPages={meta?.totalPages} onPage={setPage} onRowClick={setDetails} columns={[
        { key: 'name', label: 'Groupe', render: (g) => <div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-blood-600/10 text-blood-400"><UsersRound className="h-4 w-4" /></span><div><p className="font-semibold text-zinc-200">{g.name}</p><p className="text-[11px] text-zinc-600">{g.type}</p></div></div> },
        { key: 'manager', label: 'Responsable', render: (g) => <div><p>{g.manager || '—'}</p><p className="text-[11px] text-zinc-600">{g.phone || 'Téléphone non renseigné'}</p></div> },
        { key: 'status', label: 'Statut', render: (g) => <Badge>{g.status}</Badge> },
        { key: 'total', label: 'Total achats', className: 'text-right', render: (g) => <span className="font-semibold text-zinc-200">{currency(g.totalPurchases || 0)}</span> },
        { key: 'debt', label: 'Dette', className: 'text-right', render: (g) => <span className={(g.debt || 0) > 0 ? 'font-semibold text-amber-400' : 'text-zinc-600'}>{currency(g.debt || 0)}</span> },
        { key: 'activity', label: 'Dernière activité', render: (g) => <span className="text-xs text-zinc-500">{date(g.lastActivityAt)}</span> },
        { key: 'actions', label: '', render: (g) => <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}><Button size="sm" variant="ghost" aria-label={`Voir ${g.name}`} onClick={() => setDetails(g)}><Eye className="h-4 w-4" /></Button>{can('groups.update') && <Button size="sm" variant="ghost" aria-label={`Modifier ${g.name}`} onClick={() => openForm(g)}><Pencil className="h-4 w-4" /></Button>}{can('groups.archive') && <Button size="sm" variant="ghost" aria-label={`Archiver ${g.name}`} onClick={() => void archive(g)}><Archive className="h-4 w-4" /></Button>}</div> },
      ]} />}
    </Panel>
    <Modal open={editing !== undefined} onClose={() => setEditing(undefined)} title={editing ? 'Modifier le groupe' : 'Nouveau groupe'} description="Les notes internes restent visibles uniquement aux membres autorisés." size="lg"><form onSubmit={handleSubmit(submit)} className="p-5"><div className="grid gap-4 sm:grid-cols-2"><Input label="Nom du groupe" {...register('name')} error={errors.name?.message} /><Select label="Type" {...register('type')}><option value="organisation">Organisation</option><option value="gang">Gang</option><option value="mc">MC</option><option value="revendeur">Revendeur</option><option value="independant">Indépendant</option><option value="autre">Autre</option></Select><Input label="Responsable" {...register('manager')} /><Input label="Téléphone RP" {...register('phone')} /><Select label="Statut" {...register('status')}><option>Actif</option><option>Acheteur régulier</option><option>Acheteur occasionnel</option><option>VIP</option><option>Sous surveillance</option><option>Black-listé</option><option>Inactif</option></Select><Textarea label="Description" className="sm:col-span-2" {...register('description')} /><Textarea label="Notes internes" className="sm:col-span-2" {...register('notes')} /></div><FormActions cancel={() => setEditing(undefined)} submitting={isSubmitting} submitLabel={editing ? 'Mettre à jour' : 'Créer le groupe'} /></form></Modal>
    <Modal open={!!details} onClose={() => setDetails(null)} title={details?.name || 'Fiche groupe'} size="lg"><div className="p-5"><div className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-white/[.03] p-4"><p className="label">Total achats</p><p className="text-lg font-bold">{currency(details?.totalPurchases || 0)}</p></div><div className="rounded-xl bg-white/[.03] p-4"><p className="label">Dette actuelle</p><p className="text-lg font-bold text-amber-400">{currency(details?.debt || 0)}</p></div><div className="rounded-xl bg-white/[.03] p-4"><p className="label">Contacts</p><p className="text-lg font-bold">{details?.contactsCount || 0}</p></div></div><dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2"><div><dt className="label">Type</dt><dd>{details?.type}</dd></div><div><dt className="label">Statut</dt><dd><Badge>{details?.status}</Badge></dd></div><div><dt className="label">Responsable</dt><dd>{details?.manager || '—'}</dd></div><div><dt className="label">Téléphone</dt><dd>{details?.phone || '—'}</dd></div><div className="sm:col-span-2"><dt className="label">Description</dt><dd className="text-zinc-400">{details?.description || 'Aucune description.'}</dd></div><div className="sm:col-span-2"><dt className="label">Notes internes</dt><dd className="rounded-xl border border-amber-500/10 bg-amber-500/[.04] p-3 text-zinc-400">{details?.notes || 'Aucune note.'}</dd></div></dl>{details && can('groups.update') && <div className="mt-6 flex justify-end"><Button onClick={() => { const group = details; setDetails(null); openForm(group); }}><Pencil className="h-4 w-4" />Modifier</Button></div>}</div></Modal>
  </div>;
}
