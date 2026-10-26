import { useEffect, useState, type FormEvent } from 'react';
import { Archive, ArchiveRestore, Pencil, Plus, Tags, Trash2 } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { useToast } from '../contexts/ToastContext';
import { Badge, Button, FormActions, Input, Modal, Textarea } from './ui';

export interface ManagedCategory {
  id: string | number;
  name: string;
  description?: string | null;
  isActive?: boolean;
  usageCount?: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  helpText: string;
  endpoint: '/item-categories' | '/expense-categories';
  categories: ManagedCategory[];
  reload: () => void;
  withDescription?: boolean;
}

export function CategoryManager({ open, onClose, title, helpText, endpoint, categories, reload, withDescription = false }: Props) {
  const [editing, setEditing] = useState<ManagedCategory | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const { notify } = useToast();

  function resetForm() {
    setEditing(null);
    setName('');
    setDescription('');
  }

  useEffect(() => { if (!open) resetForm(); }, [open]);

  function edit(category: ManagedCategory) {
    setEditing(category);
    setName(category.name);
    setDescription(category.description || '');
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const trimmedName = name.trim();
    if (trimmedName.length < 2) { notify('Le nom de la catégorie doit contenir au moins 2 caractères.', 'error'); return; }
    setSaving(true);
    try {
      const body = withDescription ? { name: trimmedName, description: description.trim() || null } : { name: trimmedName };
      if (editing) await api.put(`${endpoint}/${editing.id}`, body); else await api.post(endpoint, body);
      notify(editing ? 'Catégorie mise à jour.' : 'Catégorie créée.');
      resetForm();
      reload();
    } catch (reason) {
      notify(reason instanceof ApiError ? reason.message : 'Enregistrement de la catégorie impossible.', 'error');
    } finally { setSaving(false); }
  }

  async function changeState(category: ManagedCategory, action: 'archive' | 'restore') {
    try {
      await api.post(`${endpoint}/${category.id}/${action}`);
      notify(action === 'archive' ? 'Catégorie archivée.' : 'Catégorie restaurée.');
      reload();
    } catch (reason) { notify(reason instanceof ApiError ? reason.message : 'Mise à jour impossible.', 'error'); }
  }

  async function remove(category: ManagedCategory) {
    if (!window.confirm(`Supprimer définitivement la catégorie « ${category.name} » ?`)) return;
    try {
      await api.delete(`${endpoint}/${category.id}`);
      notify('Catégorie supprimée.');
      if (editing?.id === category.id) resetForm();
      reload();
    } catch (reason) { notify(reason instanceof ApiError ? reason.message : 'Suppression impossible.', 'error'); }
  }

  return <Modal open={open} onClose={onClose} title={title} description={helpText} size="lg">
    <form onSubmit={submit} className="p-5">
      <div className="rounded-xl border border-white/[.07] bg-white/[.02] p-4">
        <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-semibold text-zinc-200">{editing ? `Modifier « ${editing.name} »` : 'Nouvelle catégorie'}</p><p className="mt-1 text-xs text-zinc-600">Vous choisissez librement le contenu de cette liste.</p></div>{editing && <Button type="button" variant="ghost" size="sm" onClick={resetForm}><Plus className="h-4 w-4" />Créer plutôt</Button>}</div>
        <div className={`mt-4 grid gap-3 ${withDescription ? 'sm:grid-cols-2' : ''}`}><Input label="Nom" value={name} onChange={(event) => setName(event.target.value)} maxLength={100} required />{withDescription && <Textarea label="Description facultative" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} />}</div>
      </div>

      <div className="mt-5 space-y-2"><h3 className="text-sm font-semibold text-zinc-200">Catégories existantes</h3>{categories.length === 0 ? <div className="rounded-xl border border-dashed border-white/10 p-8 text-center"><Tags className="mx-auto h-6 w-6 text-zinc-700" /><p className="mt-2 text-sm text-zinc-500">Aucune catégorie. Créez la première ci-dessus.</p></div> : categories.map((category) => <div key={category.id} className="flex flex-col gap-3 rounded-xl border border-white/[.06] bg-white/[.02] p-3 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-medium text-zinc-200">{category.name}</p><Badge tone={category.isActive === false ? 'neutral' : 'success'}>{category.isActive === false ? 'Archivée' : 'Active'}</Badge></div>{category.description && <p className="mt-1 truncate text-xs text-zinc-600">{category.description}</p>}<p className="mt-1 text-[11px] text-zinc-700">{category.usageCount || 0} utilisation(s)</p></div><div className="flex flex-wrap gap-1"><Button type="button" variant="ghost" size="sm" onClick={() => edit(category)}><Pencil className="h-4 w-4" />Modifier</Button>{category.isActive === false ? <Button type="button" variant="ghost" size="sm" onClick={() => void changeState(category, 'restore')}><ArchiveRestore className="h-4 w-4" />Restaurer</Button> : <Button type="button" variant="ghost" size="sm" onClick={() => void changeState(category, 'archive')}><Archive className="h-4 w-4" />Archiver</Button>}{(category.usageCount || 0) === 0 && <Button type="button" variant="danger" size="sm" aria-label={`Supprimer ${category.name}`} onClick={() => void remove(category)}><Trash2 className="h-4 w-4" /></Button>}</div></div>)}</div>
      <FormActions cancel={onClose} submitting={saving} submitLabel={editing ? 'Mettre à jour' : 'Créer la catégorie'} />
    </form>
  </Modal>;
}
