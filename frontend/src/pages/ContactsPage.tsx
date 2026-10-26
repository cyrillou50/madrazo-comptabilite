import { useMemo, useState } from 'react';
import { Archive, ContactRound, Pencil, Plus } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api, ApiError } from '../lib/api';
import { useApi } from '../hooks/useApi';
import type { Contact, Group } from '../types';
import { date } from '../lib/format';
import { listOf, metaOf } from '../lib/data';
import { Badge, Button, ErrorState, FormActions, Input, LoadingState, Modal, PageHeader, Panel, SearchField, Select, Textarea } from '../components/ui';
import { DataTable } from '../components/DataTable';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';

const schema = z.object({ firstName: z.string().min(1, 'Le prénom est obligatoire.'), lastName: z.string().min(1, 'Le nom est obligatoire.'), nickname: z.string().optional(), phone: z.string().optional(), groupId: z.string().optional(), role: z.string().optional(), status: z.string().min(1), notes: z.string().optional() });
type FormData = z.infer<typeof schema>;
const defaults: FormData = { firstName: '', lastName: '', nickname: '', phone: '', groupId: '', role: '', status: 'Actif', notes: '' };

export function ContactsPage() {
  const [search, setSearch] = useState(''); const [groupId, setGroupId] = useState(''); const [editing, setEditing] = useState<Contact | null | undefined>();
  const { data, loading, error, reload } = useApi<any>('/contacts', { search, groupId, pageSize: 50 });
  const groupsQuery = useApi<any>('/groups', { pageSize: 200, status: 'Actif' });
  const rows = useMemo(() => listOf<Contact>(data), [data]); const groups = useMemo(() => listOf<Group>(groupsQuery.data), [groupsQuery.data]); const meta = metaOf(data);
  const { notify } = useToast(); const { can } = useAuth();
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: defaults });
  function open(contact: Contact | null) { setEditing(contact); reset(contact ? { firstName: contact.firstName, lastName: contact.lastName, nickname: contact.nickname || '', phone: contact.phone || '', groupId: String(contact.groupId || ''), role: contact.role || '', status: contact.status, notes: contact.notes || '' } : defaults); }
  async function submit(values: FormData) { try { const payload = { ...values, groupId: values.groupId || null, role: undefined, roleInGroup: values.role }; if (editing) await api.put(`/contacts/${editing.id}`, payload); else await api.post('/contacts', payload); notify(editing ? 'Contact mis à jour.' : 'Contact créé.'); setEditing(undefined); reload(); } catch (reason) { notify(reason instanceof ApiError ? reason.message : 'Enregistrement impossible.', 'error'); } }
  async function archive(contact: Contact) { if (!window.confirm(`Archiver ${contact.firstName} ${contact.lastName} ?`)) return; try { await api.post(`/contacts/${contact.id}/archive`); notify('Contact archivé.'); reload(); } catch (reason) { notify(reason instanceof ApiError ? reason.message : 'Archivage impossible.', 'error'); } }

  return <div className="animate-enter"><PageHeader eyebrow="Carnet RP" title="Contacts" description="Retrouvez les interlocuteurs, leurs affiliations et l’historique de vos relations." action={can('contacts.create') ? <Button onClick={() => open(null)}><Plus className="h-4 w-4" />Nouveau contact</Button> : undefined} />
    <Panel className="overflow-hidden"><div className="flex flex-col gap-3 border-b border-white/[.07] p-4 sm:flex-row"><SearchField value={search} onChange={setSearch} placeholder="Nom, surnom ou téléphone…" /><Select aria-label="Filtrer par groupe" value={groupId} onChange={(e) => setGroupId(e.target.value)} className="sm:w-56"><option value="">Tous les groupes</option>{groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</Select><span className="ml-auto self-center text-xs text-zinc-600">{meta?.total ?? rows.length} contact(s)</span></div>
      {loading ? <LoadingState /> : error ? <ErrorState message={error} retry={reload} /> : <DataTable<Contact> rows={rows} rowKey={(c) => c.id} columns={[
        { key: 'name', label: 'Contact', render: (c) => <div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-white/[.04] text-zinc-500"><ContactRound className="h-4 w-4" /></span><div><p className="font-semibold text-zinc-200">{c.firstName} {c.lastName}</p><p className="text-[11px] text-blood-400">{c.nickname ? `« ${c.nickname} »` : 'Aucun surnom'}</p></div></div> },
        { key: 'phone', label: 'Téléphone', render: (c) => c.phone || '—' }, { key: 'group', label: 'Groupe', render: (c) => <div><p>{c.groupName || 'Indépendant'}</p><p className="text-[11px] text-zinc-600">{c.role || 'Rôle non renseigné'}</p></div> }, { key: 'status', label: 'Statut', render: (c) => <Badge>{c.status}</Badge> }, { key: 'contact', label: 'Dernier contact', render: (c) => <span className="text-xs text-zinc-500">{date(c.lastContactAt)}</span> }, { key: 'actions', label: '', render: (c) => <div className="flex justify-end gap-1">{can('contacts.update') && <Button size="sm" variant="ghost" aria-label="Modifier" onClick={() => open(c)}><Pencil className="h-4 w-4" /></Button>}{can('contacts.archive') && <Button size="sm" variant="ghost" aria-label="Archiver" onClick={() => void archive(c)}><Archive className="h-4 w-4" /></Button>}</div> },
      ]} />}
    </Panel>
    <Modal open={editing !== undefined} onClose={() => setEditing(undefined)} title={editing ? 'Modifier le contact' : 'Nouveau contact'} size="lg"><form onSubmit={handleSubmit(submit)} className="p-5"><div className="grid gap-4 sm:grid-cols-2"><Input label="Prénom RP" {...register('firstName')} error={errors.firstName?.message} /><Input label="Nom RP" {...register('lastName')} error={errors.lastName?.message} /><Input label="Surnom" {...register('nickname')} /><Input label="Téléphone RP" {...register('phone')} /><Select label="Groupe associé" {...register('groupId')}><option value="">Aucun — indépendant</option>{groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</Select><Input label="Rôle dans le groupe" {...register('role')} /><Select label="Statut" {...register('status')}><option>Actif</option><option>VIP</option><option>Sous surveillance</option><option>Black-listé</option><option>Inactif</option></Select><Textarea label="Notes privées" className="sm:col-span-2" {...register('notes')} /></div><FormActions cancel={() => setEditing(undefined)} submitting={isSubmitting} submitLabel={editing ? 'Mettre à jour' : 'Créer le contact'} /></form></Modal>
  </div>;
}
