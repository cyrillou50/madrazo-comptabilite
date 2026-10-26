import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Archive, ArchiveRestore, Pencil, Plus, Tags, Trash2 } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { listOf } from '../lib/data';
import { useApi } from '../hooks/useApi';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../contexts/ConfirmContext';
import { Badge, Button, ErrorState, FormActions, Input, LoadingState, Modal, Textarea } from './ui';

export interface ManagedCategory {
  id: string | number;
  name: string;
  description?: string | null;
  isActive?: boolean;
  usageCount?: number;
}

export type ManagedListKind = 'item-categories' | 'expense-categories' | 'group-types' | 'payment-methods';

const lists: Record<ManagedListKind, { endpoint: string; title: string; help: string; noun: string; feminine: boolean; usage: string; withDescription?: boolean }> = {
  'item-categories': {
    endpoint: '/item-categories', title: 'Catégories de marchandises', noun: 'catégorie', feminine: true, usage: 'marchandise(s)', withDescription: true,
    help: 'Créez vos propres catégories pour classer les marchandises. Aucune catégorie n’est imposée.',
  },
  'expense-categories': {
    endpoint: '/expense-categories', title: 'Catégories de dépenses', noun: 'catégorie', feminine: true, usage: 'dépense(s)',
    help: 'Créez les catégories qui vous servent à classer les dépenses.',
  },
  'group-types': {
    endpoint: '/group-types', title: 'Types de groupes', noun: 'type', feminine: false, usage: 'groupe(s)',
    help: 'Définissez vos propres types de groupes (organisation, gang, MC…).',
  },
  'payment-methods': {
    endpoint: '/payment-methods', title: 'Moyens de paiement', noun: 'moyen de paiement', feminine: false, usage: 'paiement(s)',
    help: 'Choisissez les moyens de paiement proposés lors d’un encaissement.',
  },
};

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

/** Fenêtre de gestion d'une liste personnalisable : création, renommage, archivage et suppression. */
export function CategoryManager({ open, onClose, onChanged, kind }: { open: boolean; onClose: () => void; onChanged?: () => void; kind: ManagedListKind }) {
  const config = lists[kind];
  return <Modal open={open} onClose={onClose} title={config.title} description={config.help} size="lg">
    <ListEditor kind={kind} onClose={onClose} onChanged={onChanged} />
  </Modal>;
}

function ListEditor({ kind, onClose, onChanged }: { kind: ManagedListKind; onClose: () => void; onChanged?: () => void }) {
  const config = lists[kind];
  const e = config.feminine ? 'e' : '';
  const Noun = capitalize(config.noun);
  const query = useApi<any>(config.endpoint, { includeInactive: true });
  const items = useMemo(() => listOf<ManagedCategory>(query.data), [query.data]);
  const [editing, setEditing] = useState<ManagedCategory | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const { notify } = useToast();
  const { confirm } = useConfirm();

  useEffect(() => { setName(editing?.name ?? ''); setDescription(editing?.description ?? ''); }, [editing]);

  function changed() { query.reload(); onChanged?.(); }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const trimmedName = name.trim();
    if (trimmedName.length < 2) { notify('Le nom doit contenir au moins 2 caractères.', 'error'); return; }
    setSaving(true);
    try {
      const body = config.withDescription ? { name: trimmedName, description: description.trim() || null } : { name: trimmedName };
      if (editing) await api.put(`${config.endpoint}/${editing.id}`, body); else await api.post(config.endpoint, body);
      notify(editing ? `${Noun} mis${e} à jour.` : `${Noun} créé${e}.`);
      setEditing(null); setName(''); setDescription('');
      changed();
    } catch (reason) {
      notify(reason instanceof ApiError ? reason.message : 'Enregistrement impossible.', 'error');
    } finally { setSaving(false); }
  }

  async function changeState(item: ManagedCategory, action: 'archive' | 'restore') {
    try {
      await api.post(`${config.endpoint}/${item.id}/${action}`);
      notify(action === 'archive' ? `${Noun} archivé${e} : ${config.feminine ? 'elle' : 'il'} n’est plus proposé${e}, l’historique est conservé.` : `${Noun} restauré${e}.`);
      changed();
    } catch (reason) { notify(reason instanceof ApiError ? reason.message : 'Mise à jour impossible.', 'error'); }
  }

  async function remove(item: ManagedCategory) {
    if (!await confirm({ title: `Supprimer « ${item.name} » ?`, message: 'La suppression est définitive.', confirmLabel: 'Supprimer' })) return;
    try {
      await api.delete(`${config.endpoint}/${item.id}`);
      notify(`${Noun} supprimé${e}.`);
      if (editing?.id === item.id) setEditing(null);
      changed();
    } catch (reason) { notify(reason instanceof ApiError ? reason.message : 'Suppression impossible.', 'error'); }
  }

  return <form onSubmit={submit} className="p-5">
    <div className="rounded-xl border border-white/[.07] bg-white/[.02] p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-zinc-200">{editing ? `Modifier « ${editing.name} »` : `Nouve${config.feminine ? 'lle' : 'au'} ${config.noun}`}</p>
        {editing && <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(null)}><Plus className="h-4 w-4" />Créer plutôt</Button>}
      </div>
      <div className={`mt-4 grid gap-3 ${config.withDescription ? 'sm:grid-cols-2' : ''}`}>
        <Input label="Nom" value={name} onChange={(event) => setName(event.target.value)} maxLength={100} required autoFocus />
        {config.withDescription && <Textarea label="Description (facultative)" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} className="[&_textarea]:min-h-[46px]" />}
      </div>
    </div>

    <div className="mt-5 space-y-2">
      <h3 className="text-sm font-semibold text-zinc-200">Liste actuelle</h3>
      {query.loading && !items.length ? <LoadingState /> : query.error ? <ErrorState message={query.error} retry={query.reload} /> : items.length === 0
        ? <div className="rounded-xl border border-dashed border-white/10 p-8 text-center"><Tags className="mx-auto h-6 w-6 text-zinc-700" /><p className="mt-2 text-sm text-zinc-500">La liste est vide. Ajoutez votre première entrée ci-dessus.</p></div>
        : items.map((item) => <div key={item.id} className="flex flex-col gap-3 rounded-xl border border-white/[.06] bg-white/[.02] p-3 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2"><p className="font-medium text-zinc-200">{item.name}</p>{item.isActive === false && <Badge tone="neutral">Archivé{e}</Badge>}</div>
            {item.description && <p className="mt-1 truncate text-xs text-zinc-600">{item.description}</p>}
            <p className="mt-1 text-[11px] text-zinc-700">{item.usageCount ? `Utilisé${e} par ${item.usageCount} ${config.usage}` : 'Pas encore utilisé' + e}</p>
          </div>
          <div className="flex flex-wrap gap-1">
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(item)}><Pencil className="h-4 w-4" />Renommer</Button>
            {item.isActive === false
              ? <Button type="button" variant="ghost" size="sm" onClick={() => void changeState(item, 'restore')}><ArchiveRestore className="h-4 w-4" />Restaurer</Button>
              : <Button type="button" variant="ghost" size="sm" onClick={() => void changeState(item, 'archive')}><Archive className="h-4 w-4" />Archiver</Button>}
            {!item.usageCount && <Button type="button" variant="danger" size="sm" aria-label={`Supprimer ${item.name}`} onClick={() => void remove(item)}><Trash2 className="h-4 w-4" /></Button>}
          </div>
        </div>)}
    </div>
    <FormActions cancel={onClose} cancelLabel="Fermer" submitting={saving} submitLabel={editing ? 'Enregistrer' : 'Ajouter'} />
  </form>;
}
