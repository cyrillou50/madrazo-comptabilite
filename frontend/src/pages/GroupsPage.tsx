import { useMemo, useState } from 'react';
import { Archive, Ban, Eye, Pencil, Plus, Tags, UsersRound } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api, ApiError, asData } from '../lib/api';
import { useApi } from '../hooks/useApi';
import type { Contact, Group } from '../types';
import { currency, date } from '../lib/format';
import { listOf, metaOf } from '../lib/data';
import { Badge, Button, ErrorState, FormActions, Input, LoadingState, Modal, PageHeader, Panel, SearchField, Select, Textarea } from '../components/ui';
import { DataTable } from '../components/DataTable';
import { CategoryManager, type ManagedCategory } from '../components/CategoryManager';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { useConfirm } from '../contexts/ConfirmContext';

const statuses = ['Actif', 'Acheteur régulier', 'Acheteur occasionnel', 'VIP', 'Sous surveillance', 'Black-listé', 'Inactif'];
const schema = z.object({
  name: z.string().trim().min(2, 'Le nom est obligatoire.'),
  typeId: z.string().optional(), manager: z.string().optional(), phone: z.string().optional(),
  status: z.string().min(1), description: z.string().optional(), notes: z.string().optional(), blockOrders: z.boolean(),
});
type FormData = z.infer<typeof schema>;
const defaults: FormData = { name: '', typeId: '', manager: '', phone: '', status: 'Actif', description: '', notes: '', blockOrders: false };
type GroupDetails = Group & { contacts?: Contact[] };

export function GroupsPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Group | null | undefined>(undefined);
  const [details, setDetails] = useState<GroupDetails | null>(null);
  const [typesOpen, setTypesOpen] = useState(false);
  const { can, preferences } = useAuth();
  const { data, loading, error, reload } = useApi<any>('/groups', { search, status, typeId: typeFilter, page, pageSize: preferences.defaultPageSize });
  const typesQuery = useApi<any>('/group-types', { includeInactive: true });
  const rows = useMemo(() => listOf<Group>(data), [data]);
  const types = useMemo(() => listOf<ManagedCategory>(typesQuery.data), [typesQuery.data]);
  const meta = metaOf(data);
  const { notify } = useToast();
  const { confirm } = useConfirm();
  const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: defaults });
  const selectedTypeId = watch('typeId');

  // La liste ne contient pas la description ni les notes : la fiche complète est chargée avant affichage ou modification.
  async function loadGroup(group: Group): Promise<GroupDetails | null> {
    try { return { ...group, ...asData<GroupDetails>(await api.get<any>(`/groups/${group.id}`)) }; }
    catch (reason) { notify(reason instanceof ApiError ? reason.message : 'Fiche du groupe indisponible.', 'error'); return null; }
  }
  async function openDetails(group: Group) {
    setDetails(group);
    const full = await loadGroup(group);
    if (full) setDetails(full);
  }
  async function openForm(group: Group | null) {
    if (!group) { reset(defaults); setEditing(null); return; }
    const full = await loadGroup(group);
    if (!full) return;
    reset({ name: full.name, typeId: full.typeId ? String(full.typeId) : '', manager: full.manager || '', phone: full.phone || '', status: full.status, description: full.description || '', notes: full.notes || '', blockOrders: Boolean(full.blockOrders) });
    setEditing(full);
  }
  async function submit(values: FormData) {
    try {
      const payload = { name: values.name, typeId: values.typeId || null, managerName: values.manager, phone: values.phone, status: values.status, description: values.description, internalNotes: values.notes, blockOrders: values.blockOrders };
      if (editing) await api.put(`/groups/${editing.id}`, payload); else await api.post('/groups', payload);
      notify(editing ? 'Groupe mis à jour.' : 'Groupe créé.'); setEditing(undefined); reload();
    } catch (reason) { notify(reason instanceof ApiError ? reason.message : 'Enregistrement impossible.', 'error'); }
  }
  async function archive(group: Group) {
    if (!await confirm({ title: `Archiver « ${group.name} » ?`, message: 'Le groupe ne sera plus proposé, mais son historique (ventes, dettes) est conservé.', confirmLabel: 'Archiver' })) return;
    try { await api.post(`/groups/${group.id}/archive`); notify('Groupe archivé.'); reload(); }
    catch (reason) { notify(reason instanceof ApiError ? reason.message : 'Archivage impossible.', 'error'); }
  }

  const selectableTypes = types.filter((type) => type.isActive !== false || String(type.id) === selectedTypeId);

  return <div className="animate-enter"><PageHeader eyebrow="Relations commerciales" title="Groupes" description="Centralisez les acheteurs, leurs conditions tarifaires, leurs contacts et leurs dettes." action={<div className="flex flex-wrap gap-2">{can('groups.write') && <Button variant="secondary" onClick={() => setTypesOpen(true)}><Tags className="h-4 w-4" />Types de groupes</Button>}{can('groups.create') && <Button onClick={() => void openForm(null)}><Plus className="h-4 w-4" />Nouveau groupe</Button>}</div>} />
    <Panel className="overflow-hidden"><div className="flex flex-col gap-3 border-b border-white/[.07] p-4 sm:flex-row sm:items-center"><SearchField value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Nom, type, responsable ou téléphone…" /><Select aria-label="Filtrer par type" value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }} className="sm:w-48"><option value="">Tous les types</option>{types.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</Select><Select aria-label="Filtrer par statut" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="sm:w-52"><option value="">Tous les statuts</option>{statuses.map((x) => <option key={x}>{x}</option>)}</Select><span className="ml-auto text-xs text-zinc-600">{meta?.total ?? rows.length} groupe(s)</span></div>
      {loading ? <LoadingState /> : error ? <ErrorState message={error} retry={reload} /> : <DataTable<Group> rows={rows} rowKey={(g) => g.id} page={meta?.page || page} totalPages={meta?.totalPages} onPage={setPage} onRowClick={(group) => void openDetails(group)} columns={[
        { key: 'name', label: 'Groupe', render: (g) => <div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-blood-600/10 text-blood-400"><UsersRound className="h-4 w-4" /></span><div><p className="flex items-center gap-1.5 font-semibold text-zinc-200">{g.name}{Boolean(g.blockOrders) && <Ban className="h-3.5 w-3.5 text-red-400" aria-label="Ventes bloquées" />}</p><p className="text-[11px] text-zinc-600">{g.typeName || 'Sans type'}</p></div></div> },
        { key: 'manager', label: 'Responsable', render: (g) => <div><p>{g.manager || '—'}</p><p className="text-[11px] text-zinc-600">{g.phone || 'Téléphone non renseigné'}</p></div> },
        { key: 'status', label: 'Statut', render: (g) => <Badge>{g.status}</Badge> },
        { key: 'total', label: 'Total achats', className: 'text-right', render: (g) => <span className="font-semibold text-zinc-200">{currency(g.totalPurchases || 0)}</span> },
        { key: 'debt', label: 'Dette', className: 'text-right', render: (g) => <span className={(g.debt || 0) > 0 ? 'font-semibold text-amber-400' : 'text-zinc-600'}>{currency(g.debt || 0)}</span> },
        { key: 'activity', label: 'Dernière activité', render: (g) => <span className="text-xs text-zinc-500">{date(g.lastActivityAt)}</span> },
        { key: 'actions', label: '', render: (g) => <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}><Button size="sm" variant="ghost" aria-label={`Voir ${g.name}`} onClick={() => void openDetails(g)}><Eye className="h-4 w-4" /></Button>{can('groups.update') && <Button size="sm" variant="ghost" aria-label={`Modifier ${g.name}`} onClick={() => void openForm(g)}><Pencil className="h-4 w-4" /></Button>}{can('groups.archive') && <Button size="sm" variant="ghost" aria-label={`Archiver ${g.name}`} onClick={() => void archive(g)}><Archive className="h-4 w-4" /></Button>}</div> },
      ]} />}
    </Panel>
    <Modal open={editing !== undefined} onClose={() => setEditing(undefined)} title={editing ? 'Modifier le groupe' : 'Nouveau groupe'} description="Les notes internes restent visibles uniquement aux membres autorisés." size="lg"><form onSubmit={handleSubmit(submit)} className="p-5"><div className="grid gap-4 sm:grid-cols-2">
      <Input label="Nom du groupe" {...register('name')} error={errors.name?.message} />
      <Select label="Type" {...register('typeId')} hint={!types.length && can('groups.write') ? <button type="button" className="font-semibold text-blood-400 hover:text-blood-300" onClick={() => setTypesOpen(true)}>Créer vos types de groupes</button> : undefined}><option value="">Sans type</option>{selectableTypes.map((type) => <option key={type.id} value={type.id}>{type.name}{type.isActive === false ? ' (archivé)' : ''}</option>)}</Select>
      <Input label="Responsable" {...register('manager')} />
      <Input label="Téléphone" {...register('phone')} />
      <Select label="Statut" {...register('status')}>{statuses.map((x) => <option key={x}>{x}</option>)}</Select>
      <label className="flex items-center gap-3 self-end rounded-xl border border-white/[.07] bg-white/[.02] p-3 text-sm text-zinc-300"><input type="checkbox" className="h-4 w-4 accent-blood-600" {...register('blockOrders')} />Bloquer les nouvelles ventes</label>
      <Textarea label="Description" className="sm:col-span-2" {...register('description')} />
      <Textarea label="Notes internes" className="sm:col-span-2" {...register('notes')} />
    </div><FormActions cancel={() => setEditing(undefined)} submitting={isSubmitting} submitLabel={editing ? 'Mettre à jour' : 'Créer le groupe'} /></form></Modal>
    <Modal open={!!details} onClose={() => setDetails(null)} title={details?.name || 'Fiche groupe'} description={details?.typeName || undefined} size="lg"><div className="p-5">
      <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-white/[.03] p-4"><p className="label">Total achats</p><p className="text-lg font-bold">{currency(details?.totalPurchases || 0)}</p></div><div className="rounded-xl bg-white/[.03] p-4"><p className="label">Dette actuelle</p><p className="text-lg font-bold text-amber-400">{currency(details?.debt || 0)}</p></div><div className="rounded-xl bg-white/[.03] p-4"><p className="label">Contacts</p><p className="text-lg font-bold">{details?.contactsCount ?? details?.contacts?.length ?? 0}</p></div></div>
      {Boolean(details?.blockOrders) && <p className="mt-4 flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/[.06] p-3 text-sm text-red-300"><Ban className="h-4 w-4" />Les nouvelles ventes sont bloquées pour ce groupe.</p>}
      <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2"><div><dt className="label">Type</dt><dd>{details?.typeName || 'Sans type'}</dd></div><div><dt className="label">Statut</dt><dd><Badge>{details?.status}</Badge></dd></div><div><dt className="label">Responsable</dt><dd>{details?.manager || '—'}</dd></div><div><dt className="label">Téléphone</dt><dd>{details?.phone || '—'}</dd></div><div className="sm:col-span-2"><dt className="label">Description</dt><dd className="whitespace-pre-line text-zinc-400">{details?.description || 'Aucune description.'}</dd></div>{can('groups.write') && <div className="sm:col-span-2"><dt className="label">Notes internes</dt><dd className="whitespace-pre-line rounded-xl border border-amber-500/10 bg-amber-500/[.04] p-3 text-zinc-400">{details?.notes || 'Aucune note.'}</dd></div>}</dl>
      {!!details?.contacts?.length && <div className="mt-5"><p className="label">Membres</p><div className="divide-y divide-white/[.055] rounded-xl border border-white/[.07]">{details.contacts.map((contact) => <div key={contact.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"><span className="text-zinc-300">{contact.firstName} {contact.lastName}{contact.nickname ? <span className="text-blood-400"> « {contact.nickname} »</span> : null}</span><span className="text-xs text-zinc-600">{contact.role || '—'}</span></div>)}</div></div>}
      {details && can('groups.update') && <div className="mt-6 flex justify-end"><Button onClick={() => { const group = details; setDetails(null); void openForm(group); }}><Pencil className="h-4 w-4" />Modifier</Button></div>}
    </div></Modal>
    <CategoryManager open={typesOpen} onClose={() => setTypesOpen(false)} onChanged={() => { typesQuery.reload(); reload(); }} kind="group-types" />
  </div>;
}
