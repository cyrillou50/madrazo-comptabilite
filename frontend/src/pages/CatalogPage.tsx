import { useMemo, useState } from 'react';
import { Archive, CircleDollarSign, PackagePlus, Pencil, Plus, Tags } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api, ApiError } from '../lib/api';
import { useApi } from '../hooks/useApi';
import type { Item } from '../types';
import { currency, currencySymbol, number } from '../lib/format';
import { listOf, metaOf } from '../lib/data';
import { Badge, Button, ErrorState, FormActions, Input, LoadingState, Modal, PageHeader, Panel, SearchField, Select, Textarea } from '../components/ui';
import { DataTable } from '../components/DataTable';
import { CategoryManager, type ManagedCategory } from '../components/CategoryManager';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { useConfirm } from '../contexts/ConfirmContext';

const schema = z.object({ name: z.string().trim().min(2, 'Le nom est obligatoire.'), categoryId: z.string().min(1, 'Choisissez une catégorie.'), reference: z.string().trim().min(2, 'La référence est obligatoire.'), description: z.string().optional(), unitCost: z.coerce.number<number>().min(0, 'Le coût ne peut pas être négatif.'), defaultPrice: z.coerce.number<number>().min(0, 'Le prix ne peut pas être négatif.'), minimumPrice: z.coerce.number<number>().min(0, 'Le prix ne peut pas être négatif.'), unit: z.string().trim().min(1, 'L’unité est obligatoire.'), alertThreshold: z.coerce.number<number>().int().min(0), active: z.boolean() }).refine((v) => v.defaultPrice >= v.minimumPrice, { path: ['defaultPrice'], message: 'Le prix de vente doit être supérieur ou égal au prix minimum.' });
type FormData = z.infer<typeof schema>;
const defaults: FormData = { name: '', categoryId: '', reference: '', description: '', unitCost: 0, defaultPrice: 0, minimumPrice: 0, unit: 'unité', alertThreshold: 0, active: true };

export function CatalogPage() {
  const [search, setSearch] = useState(''); const [categoryId, setCategoryId] = useState(''); const [availability, setAvailability] = useState(''); const [page, setPage] = useState(1); const [editing, setEditing] = useState<Item | null | undefined>(); const [categoriesOpen, setCategoriesOpen] = useState(false);
  const { data, loading, error, reload } = useApi<any>('/items', { search, categoryId, status: availability, page, pageSize: 100 });
  const categoriesQuery = useApi<any>('/item-categories', { includeInactive: true });
  const rows = useMemo(() => listOf<Item>(data), [data]); const categories = useMemo(() => listOf<ManagedCategory>(categoriesQuery.data), [categoriesQuery.data]); const meta = metaOf(data);
  const { notify } = useToast(); const { can } = useAuth(); const { confirm } = useConfirm();
  const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: defaults });
  const watchedCost = Number(watch('unitCost')) || 0; const watchedPrice = Number(watch('defaultPrice')) || 0; const watchedCategory = watch('categoryId');
  const symbol = currencySymbol();
  const selectableCategories = categories.filter((category) => category.isActive !== false || String(category.id) === watchedCategory);

  function open(item: Item | null) { setEditing(item); reset(item ? { name: item.name, categoryId: String(item.categoryId || ''), reference: item.reference, description: item.description || '', unitCost: item.unitCost, defaultPrice: item.defaultPrice, minimumPrice: item.minimumPrice || 0, unit: item.unit, alertThreshold: item.alertThreshold, active: item.active } : defaults); }
  async function submit(values: FormData) { try { const payload = { name: values.name, categoryId: values.categoryId, sku: values.reference, description: values.description, unitCostCents: Math.round(values.unitCost * 100), defaultPriceCents: Math.round(values.defaultPrice * 100), minimumPriceCents: Math.round(values.minimumPrice * 100), unit: values.unit, alertThreshold: values.alertThreshold, isActive: values.active }; if (editing) await api.put(`/items/${editing.id}`, payload); else await api.post('/items', payload); notify(editing ? 'Marchandise mise à jour.' : 'Marchandise ajoutée.'); setEditing(undefined); reload(); categoriesQuery.reload(); } catch (reason) { notify(reason instanceof ApiError ? reason.message : 'Enregistrement impossible.', 'error'); } }
  async function archive(item: Item) {
    if (!await confirm({ title: `Archiver « ${item.name} » ?`, message: 'La marchandise ne sera plus proposée à la vente. Son historique est conservé.', confirmLabel: 'Archiver' })) return;
    try { await api.post(`/items/${item.id}/archive`); notify('Marchandise archivée.'); reload(); categoriesQuery.reload(); } catch (reason) { notify(reason instanceof ApiError ? reason.message : 'Archivage impossible.', 'error'); }
  }

  return <div className="animate-enter"><PageHeader eyebrow="Catalogue interne" title="Marchandises" description="Gérez les références, les coûts, les prix de vente et les seuils d’alerte." action={<div className="flex flex-wrap gap-2">{can('catalog.write') && <Button variant="secondary" onClick={() => setCategoriesOpen(true)}><Tags className="h-4 w-4" />Catégories</Button>}{can('items.create') && <Button onClick={() => open(null)}><Plus className="h-4 w-4" />Nouvel article</Button>}</div>} />
    <div className="mb-4 grid gap-3 sm:grid-cols-3"><Panel className="p-4"><p className="label">Références</p><p className="mt-1 text-2xl font-bold">{number(meta?.total ?? rows.length)}</p></Panel><Panel className="p-4"><p className="label">Valeur du stock au coût</p><p className="mt-1 text-2xl font-bold">{currency(rows.reduce((s, i) => s + i.unitCost * Math.max(0, i.stock), 0))}</p></Panel><Panel className="p-4"><p className="label">Articles à surveiller</p><p className="mt-1 text-2xl font-bold text-amber-400">{rows.filter((i) => i.stock <= i.alertThreshold).length}</p></Panel></div>
    <Panel className="overflow-hidden"><div className="flex flex-col gap-3 border-b border-white/[.07] p-4 lg:flex-row"><SearchField value={search} onChange={(value) => { setSearch(value); setPage(1); }} placeholder="Nom ou référence…" /><Select aria-label="Catégorie" value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setPage(1); }} className="lg:w-52"><option value="">Toutes les catégories</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}{c.isActive === false ? ' (archivée)' : ''}</option>)}</Select><Select aria-label="Disponibilité" value={availability} onChange={(e) => { setAvailability(e.target.value); setPage(1); }} className="lg:w-52"><option value="">Toute disponibilité</option><option value="available">En stock</option><option value="low">Stock faible</option><option value="out">En rupture</option></Select></div>
      {loading ? <LoadingState /> : error ? <ErrorState message={error} retry={reload} /> : <DataTable<Item> rows={rows} rowKey={(i) => i.id} page={meta?.page || page} totalPages={meta?.totalPages} onPage={setPage} emptyTitle="Aucune marchandise" emptyDescription={categories.length ? 'Ajoutez une première marchandise ou modifiez vos filtres.' : 'Commencez par créer vos catégories, puis ajoutez vos marchandises.'} columns={[
        { key: 'item', label: 'Article', render: (i) => <div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-blood-500/[.08] text-blood-400"><PackagePlus className="h-4 w-4" /></span><div><p className="font-semibold text-zinc-200">{i.name}</p><p className="font-mono text-[10px] text-zinc-600">{i.reference}</p></div></div> },
        { key: 'category', label: 'Catégorie', render: (i) => i.categoryName || '—' }, { key: 'cost', label: 'Coût', className: 'text-right', render: (i) => currency(i.unitCost) }, { key: 'price', label: 'Prix de vente', className: 'text-right', render: (i) => <div><p className="font-semibold text-zinc-200">{currency(i.defaultPrice)}</p><p className="text-[10px] text-emerald-400">+{currency(i.defaultPrice - i.unitCost)}</p></div> }, { key: 'stock', label: 'Stock', className: 'text-right', render: (i) => <div><p className={i.stock <= i.alertThreshold ? 'font-bold text-amber-400' : 'font-semibold text-zinc-200'}>{number(i.stock)} {i.unit}</p><p className="text-[10px] text-zinc-600">Seuil {number(i.alertThreshold)}</p></div> }, { key: 'status', label: 'État', render: (i) => <Badge tone={i.active ? (i.stock <= 0 ? 'danger' : i.stock <= i.alertThreshold ? 'warning' : 'success') : 'neutral'}>{i.active ? (i.stock <= 0 ? 'Rupture' : i.stock <= i.alertThreshold ? 'Stock faible' : 'En vente') : 'Hors vente'}</Badge> }, { key: 'actions', label: '', render: (i) => <div className="flex justify-end gap-1">{can('items.update') && <Button variant="ghost" size="sm" aria-label={`Modifier ${i.name}`} onClick={() => open(i)}><Pencil className="h-4 w-4" /></Button>}{can('items.archive') && <Button variant="ghost" size="sm" aria-label={`Archiver ${i.name}`} onClick={() => void archive(i)}><Archive className="h-4 w-4" /></Button>}</div> },
      ]} />}
    </Panel>
    <Modal open={editing !== undefined} onClose={() => setEditing(undefined)} title={editing ? 'Modifier la marchandise' : 'Nouvelle marchandise'} description="Les prix transmis par l’interface seront toujours recalculés par le serveur." size="lg"><form onSubmit={handleSubmit(submit)} className="p-5"><div className="grid gap-4 sm:grid-cols-2">
      <Input label="Nom" {...register('name')} error={errors.name?.message} />
      <Input label="Référence interne" {...register('reference')} error={errors.reference?.message} />
      <Select label="Catégorie" {...register('categoryId')} error={errors.categoryId?.message} hint={!categories.length && can('catalog.write') ? <button type="button" className="font-semibold text-blood-400 hover:text-blood-300" onClick={() => setCategoriesOpen(true)}>Créer une catégorie</button> : undefined}><option value="">Sélectionner…</option>{selectableCategories.map((c) => <option key={c.id} value={c.id}>{c.name}{c.isActive === false ? ' (archivée)' : ''}</option>)}</Select>
      <Input label="Unité" {...register('unit')} error={errors.unit?.message} />
      <Input label={`Coût unitaire (${symbol})`} type="number" min="0" step="1" {...register('unitCost')} error={errors.unitCost?.message} />
      <Input label={`Prix de vente (${symbol})`} type="number" min="0" step="1" {...register('defaultPrice')} error={errors.defaultPrice?.message} />
      <Input label={`Prix minimum (${symbol})`} type="number" min="0" step="1" {...register('minimumPrice')} error={errors.minimumPrice?.message} />
      <Input label="Seuil d’alerte" type="number" min="0" step="1" {...register('alertThreshold')} />
      <Textarea label="Description" className="sm:col-span-2" {...register('description')} />
      <label className="flex items-center gap-3 rounded-xl border border-white/[.07] bg-white/[.02] p-3 text-sm text-zinc-300 sm:col-span-2"><input type="checkbox" className="h-4 w-4 accent-blood-600" {...register('active')} />Article disponible à la vente</label>
    </div><div className="mt-4 flex items-center gap-3 rounded-xl border border-emerald-500/10 bg-emerald-500/[.035] p-4"><CircleDollarSign className="h-5 w-5 text-emerald-400" /><div><p className="text-xs text-zinc-500">Marge unitaire estimée</p><p className="font-bold text-emerald-300">{currency(watchedPrice - watchedCost)}</p></div></div><FormActions cancel={() => setEditing(undefined)} submitting={isSubmitting} submitLabel={editing ? 'Mettre à jour' : 'Ajouter au catalogue'} /></form></Modal>
    <CategoryManager open={categoriesOpen} onClose={() => setCategoriesOpen(false)} onChanged={() => { categoriesQuery.reload(); reload(); }} kind="item-categories" />
  </div>;
}
