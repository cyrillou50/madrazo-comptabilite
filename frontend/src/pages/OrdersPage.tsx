import { useMemo, useState } from 'react';
import { Check, ChevronRight, ClipboardList, PackageCheck, Plus, Trash2, XCircle } from 'lucide-react';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api, ApiError, asData } from '../lib/api';
import { useApi } from '../hooks/useApi';
import type { Contact, Group, Item, Order, Payment } from '../types';
import { currency, date, number } from '../lib/format';
import { orderPreviewTotal } from '../lib/order';
import { listOf, metaOf } from '../lib/data';
import { Badge, Button, ErrorState, FormActions, Input, LoadingState, Modal, PageHeader, Panel, SearchField, Select, Textarea } from '../components/ui';
import { DataTable } from '../components/DataTable';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { useConfirm } from '../contexts/ConfirmContext';

const schema = z.object({ groupId: z.string().optional(), contactId: z.string().optional(), notes: z.string().max(2000).optional(), items: z.array(z.object({ itemId: z.string().min(1, 'Article obligatoire.'), quantity: z.coerce.number<number>().int('Quantité entière.').min(1, 'Quantité minimale : 1.'), discount: z.coerce.number<number>().min(0, 'Minimum 0 %.').max(100, 'Maximum 100 %.') })).min(1, 'Ajoutez au moins un article.') });
type FormData = z.infer<typeof schema>;
const emptyForm: FormData = { groupId: '', contactId: '', notes: '', items: [{ itemId: '', quantity: 1, discount: 0 }] };
type OrderDetails = Order & { payments?: Payment[] };

const isBlocked = (group?: Group) => !!group && (group.status === 'Black-listé' || Boolean(group.blockOrders));

export function OrdersPage() {
  const [search, setSearch] = useState(''); const [status, setStatus] = useState(''); const [paymentStatus, setPaymentStatus] = useState(''); const [page, setPage] = useState(1); const [creating, setCreating] = useState(false); const [selected, setSelected] = useState<OrderDetails | null>(null);
  const { can, preferences } = useAuth();
  const ordersQuery = useApi<any>('/orders', { search, status, paymentStatus, page, pageSize: preferences.defaultPageSize });
  // L'API limite chaque liste à 100 lignes.
  const groupsQuery = useApi<any>('/groups', { pageSize: 100 }); const contactsQuery = useApi<any>('/contacts', { pageSize: 100 }); const itemsQuery = useApi<any>('/items', { pageSize: 100, active: true });
  const orders = useMemo(() => listOf<Order>(ordersQuery.data), [ordersQuery.data]); const groups = useMemo(() => listOf<Group>(groupsQuery.data), [groupsQuery.data]); const contacts = useMemo(() => listOf<Contact>(contactsQuery.data), [contactsQuery.data]); const items = useMemo(() => listOf<Item>(itemsQuery.data).filter((item) => item.active !== false), [itemsQuery.data]); const meta = metaOf(ordersQuery.data);
  const { notify } = useToast(); const { confirm, prompt } = useConfirm();
  const canOverrideBlock = can('groups.override_block');
  const form = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: emptyForm });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'items' }); const watchedLines = form.watch('items'); const watchedGroup = form.watch('groupId');
  const matchingContacts = contacts.filter((c) => !watchedGroup || String(c.groupId || '') === watchedGroup); const selectedGroup = groups.find((g) => String(g.id) === watchedGroup);
  const previewLines = watchedLines.map((line) => ({ ...line, unitPrice: items.find((i) => String(i.id) === line.itemId)?.defaultPrice || 0 })); const previewTotal = orderPreviewTotal(previewLines);
  const listsError = groupsQuery.error || contactsQuery.error || itemsQuery.error;

  function openCreate() { form.reset(emptyForm); setCreating(true); }
  function closeCreate() { setCreating(false); form.reset(emptyForm); }
  async function openOrder(order: Order) {
    setSelected(order);
    try {
      const result = await api.get<any>(`/orders/${order.id}`);
      setSelected({ ...order, ...asData<OrderDetails>(result) });
    } catch (reason) {
      notify(reason instanceof ApiError ? reason.message : 'Détail de la commande indisponible.', 'error');
    }
  }
  async function submit(values: FormData) {
    try {
      const result = await api.post<any>('/orders', { groupId: values.groupId || null, contactId: values.contactId || null, notes: values.notes, items: values.items.map((line) => ({ itemId: line.itemId, quantity: line.quantity, discountPercent: line.discount })) });
      const reference = result?.data?.reference || result?.reference;
      notify(reference ? `Vente ${reference} créée.` : 'Vente créée.'); closeCreate(); ordersQuery.reload(); itemsQuery.reload();
    } catch (reason) { notify(reason instanceof ApiError ? reason.message : 'Création impossible.', 'error'); }
  }
  async function changeStatus(order: Order, nextStatus: string) {
    if (!await confirm({ title: `Passer ${order.reference} au statut « ${nextStatus} » ?`, tone: 'primary', confirmLabel: 'Confirmer' })) return;
    try { await api.patch(`/orders/${order.id}/status`, { status: nextStatus }); notify('Statut de la vente mis à jour.'); setSelected(null); ordersQuery.reload(); }
    catch (reason) { notify(reason instanceof ApiError ? reason.message : 'Mise à jour impossible.', 'error'); }
  }
  async function cancelOrder(order: Order) {
    const reason = await prompt({ title: `Annuler la vente ${order.reference} ?`, message: 'Les réservations de stock seront libérées. Une vente déjà livrée ou payée ne peut pas être annulée.', label: 'Motif de l’annulation', placeholder: 'Ex. : client injoignable', minLength: 3, confirmLabel: 'Annuler la vente' });
    if (!reason) return;
    try { await api.post(`/orders/${order.id}/cancel`, { reason }); notify('Vente annulée.'); setSelected(null); ordersQuery.reload(); itemsQuery.reload(); }
    catch (error) { notify(error instanceof ApiError ? error.message : 'Annulation impossible.', 'error'); }
  }
  async function deliverAll(order: Order) {
    if (!await confirm({ title: `Livrer le solde de ${order.reference} ?`, message: 'Les quantités restantes seront déduites du stock.', tone: 'primary', confirmLabel: 'Livrer' })) return;
    try { await api.post(`/orders/${order.id}/deliveries`, { idempotencyKey: crypto.randomUUID(), items: (order.items || []).map((line) => ({ orderItemId: line.id, quantity: line.quantity - (line.deliveredQuantity || 0) })).filter((x) => x.quantity > 0) }); notify('Livraison enregistrée et stock mis à jour.'); setSelected(null); ordersQuery.reload(); itemsQuery.reload(); }
    catch (reason) { notify(reason instanceof ApiError ? reason.message : 'Livraison impossible.', 'error'); }
  }

  const lineGrid = 'md:grid-cols-[minmax(220px,1fr)_110px_110px_130px_38px]';
  return <div className="animate-enter"><PageHeader eyebrow="Cycle commercial" title="Ventes" description="Créez des commandes multi-articles, suivez leur livraison et leur règlement." action={can('orders.create') ? <Button onClick={openCreate}><Plus className="h-4 w-4" />Nouvelle vente</Button> : undefined} />
    <Panel className="overflow-hidden"><div className="flex flex-col gap-3 border-b border-white/[.07] p-4 xl:flex-row"><SearchField value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Référence ou groupe…" /><Select aria-label="Statut commande" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="xl:w-52"><option value="">Tous les statuts</option>{['Brouillon','En attente','Confirmée','Partiellement livrée','Livrée','Annulée'].map((s) => <option key={s}>{s}</option>)}</Select><Select aria-label="Statut paiement" value={paymentStatus} onChange={(e) => { setPaymentStatus(e.target.value); setPage(1); }} className="xl:w-52"><option value="">Tout paiement</option><option>Non payé</option><option>Partiellement payé</option><option>Payé</option></Select><span className="ml-auto self-center text-xs text-zinc-600">{meta?.total ?? orders.length} vente(s)</span></div>
      {ordersQuery.loading ? <LoadingState /> : ordersQuery.error ? <ErrorState message={ordersQuery.error} retry={ordersQuery.reload} /> : <DataTable<Order> rows={orders} rowKey={(o) => o.id} onRowClick={(order) => void openOrder(order)} page={meta?.page || page} totalPages={meta?.totalPages} onPage={setPage} emptyTitle="Aucune vente" emptyDescription="Créez une première vente ou modifiez vos filtres." columns={[
        { key: 'ref', label: 'Référence', render: (o) => <div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-blood-600/10 text-blood-400"><ClipboardList className="h-4 w-4" /></span><div><p className="font-mono text-xs font-bold text-zinc-200">{o.reference}</p><p className="text-[10px] text-zinc-600">{date(o.orderDate)}</p></div></div> }, { key: 'buyer', label: 'Acheteur', render: (o) => <div><p>{o.groupName || 'Indépendant'}</p><p className="text-[11px] text-zinc-600">{o.sellerName ? `Vendeur : ${o.sellerName}` : ''}</p></div> }, { key: 'status', label: 'Commande', render: (o) => <Badge>{o.status}</Badge> }, { key: 'payment', label: 'Paiement', render: (o) => <Badge>{o.paymentStatus}</Badge> }, { key: 'margin', label: 'Marge', className: 'text-right', render: (o) => <span className="text-emerald-400">{currency(o.estimatedMargin || 0)}</span> }, { key: 'total', label: 'Total', className: 'text-right', render: (o) => <div><p className="font-bold text-zinc-200">{currency(o.totalAmount)}</p>{(o.remainingAmount || 0) > 0 && <p className="text-[10px] text-amber-400">Reste {currency(o.remainingAmount || 0)}</p>}</div> }, { key: 'open', label: '', render: () => <ChevronRight className="ml-auto h-4 w-4 text-zinc-700" /> },
      ]} />}
    </Panel>

    <Modal open={creating} onClose={closeCreate} title="Nouvelle vente" description="Les tarifs, la disponibilité et les totaux définitifs seront validés par le serveur." size="xl"><form onSubmit={form.handleSubmit(submit)} className="p-5">
      {listsError && <p className="mb-4 rounded-xl border border-red-500/20 bg-red-500/[.06] p-3 text-sm text-red-300">Certaines listes n’ont pas pu être chargées : {listsError}</p>}
      <div className="grid gap-4 sm:grid-cols-2"><Select label="Groupe acheteur" {...form.register('groupId')}><option value="">Acheteur indépendant</option>{groups.map((g) => <option key={g.id} value={g.id} disabled={isBlocked(g) && !canOverrideBlock}>{g.name}{isBlocked(g) ? ' — ventes bloquées' : ''}</option>)}</Select><Select label="Contact associé" {...form.register('contactId')}><option value="">Aucun contact</option>{matchingContacts.map((c) => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}{c.nickname ? ` — ${c.nickname}` : ''}</option>)}</Select></div>
      {isBlocked(selectedGroup) && <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/[.06] p-3 text-sm text-red-300">Les ventes sont bloquées pour ce groupe.{canOverrideBlock ? ' Votre rôle vous permet de passer outre.' : ''}</div>}
      <div className="mt-6"><div className="mb-3 flex items-center justify-between gap-3"><div><h3 className="text-sm font-semibold text-zinc-200">Articles de la vente</h3><p className="mt-0.5 text-xs text-zinc-600">Prix indicatif : les tarifs de groupe sont appliqués à l’enregistrement.</p></div><Button type="button" variant="secondary" size="sm" onClick={() => append({ itemId: '', quantity: 1, discount: 0 })}><Plus className="h-4 w-4" />Ajouter une ligne</Button></div>
        {!items.length && !itemsQuery.loading && <p className="mb-3 rounded-xl border border-dashed border-white/10 p-4 text-center text-sm text-zinc-500">Aucune marchandise disponible à la vente. Ajoutez-en depuis « Marchandises ».</p>}
        <div className={`mb-2 hidden gap-2 px-3 text-[10px] font-bold uppercase tracking-[.14em] text-zinc-600 md:grid ${lineGrid}`}><span>Article</span><span>Quantité</span><span>Remise (%)</span><span className="text-right">Total</span><span /></div>
        <div className="space-y-2">{fields.map((field, index) => { const selectedItem = items.find((i) => String(i.id) === watchedLines[index]?.itemId); const lineTotal = orderPreviewTotal([previewLines[index] || { quantity: 0 }]); const lineErrors = form.formState.errors.items?.[index]; return <div key={field.id} className={`grid gap-2 rounded-xl border border-white/[.07] bg-white/[.02] p-3 ${lineGrid}`}>
          <Select label="Article" className="md:[&>.label]:hidden" aria-label={`Article ligne ${index + 1}`} {...form.register(`items.${index}.itemId`)} error={lineErrors?.itemId?.message}><option value="">Sélectionner un article…</option>{items.map((i) => <option key={i.id} value={i.id} disabled={i.stock <= 0}>{i.name} — {currency(i.defaultPrice)} ({i.stock > 0 ? `${number(i.stock)} dispo.` : 'rupture'})</option>)}</Select>
          <Input label="Quantité" className="md:[&>.label]:hidden" aria-label={`Quantité ligne ${index + 1}`} type="number" min="1" step="1" {...form.register(`items.${index}.quantity`)} error={lineErrors?.quantity?.message} />
          <Input label="Remise (%)" className="md:[&>.label]:hidden" aria-label={`Remise en pourcentage ligne ${index + 1}`} type="number" min="0" max="100" step="1" {...form.register(`items.${index}.discount`)} error={lineErrors?.discount?.message} />
          <div className="flex items-center justify-end rounded-xl bg-ink-950/60 px-3 py-2 text-right"><div><p className="text-sm font-bold text-zinc-200">{currency(lineTotal)}</p><p className={`text-[10px] ${(selectedItem?.stock || 0) < Number(watchedLines[index]?.quantity || 0) ? 'text-red-400' : 'text-zinc-600'}`}>{selectedItem ? `${number(selectedItem.stock)} en stock` : 'Prix estimé'}</p></div></div>
          <button type="button" onClick={() => remove(index)} disabled={fields.length === 1} className="grid h-10 w-10 place-items-center self-center justify-self-end rounded-lg text-zinc-600 hover:bg-red-500/10 hover:text-red-400 disabled:opacity-25" aria-label={`Supprimer la ligne ${index + 1}`}><Trash2 className="h-4 w-4" /></button>
        </div>; })}</div></div>
      <Textarea label="Notes" className="mt-4" placeholder="Informations utiles pour la livraison ou le paiement…" {...form.register('notes')} />
      <div className="mt-5 flex flex-col items-end rounded-xl border border-blood-500/15 bg-blood-500/[.035] p-4"><p className="label">Total estimatif</p><p className="text-2xl font-bold text-white">{currency(previewTotal)}</p><p className="mt-1 text-[10px] text-zinc-600">Le montant final est calculé par le serveur.</p></div><FormActions cancel={closeCreate} submitting={form.formState.isSubmitting} submitLabel="Créer la vente" /></form></Modal>

    <Modal open={!!selected} onClose={() => setSelected(null)} title={selected?.reference || 'Vente'} description={`${selected?.groupName || 'Acheteur indépendant'} · ${date(selected?.orderDate)}`} size="lg"><div className="p-5"><div className="mb-5 grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-white/[.03] p-4"><p className="label">Total</p><p className="text-lg font-bold">{currency(selected?.totalAmount || 0)}</p></div><div className="rounded-xl bg-white/[.03] p-4"><p className="label">Déjà encaissé</p><p className="text-lg font-bold text-emerald-400">{currency(selected?.paidAmount || 0)}</p></div><div className="rounded-xl bg-white/[.03] p-4"><p className="label">Reste dû</p><p className="text-lg font-bold text-amber-400">{currency(selected?.remainingAmount || 0)}</p></div></div>
      <div className="mb-4 flex flex-wrap gap-2"><Badge>{selected?.status}</Badge><Badge>{selected?.paymentStatus}</Badge>{selected?.sellerName && <span className="self-center text-xs text-zinc-600">Vendeur : {selected.sellerName}</span>}</div>
      <div className="overflow-hidden rounded-xl border border-white/[.07]"><table className="w-full text-left text-sm"><thead className="bg-white/[.025] text-[10px] uppercase tracking-wider text-zinc-600"><tr><th className="p-3">Article</th><th className="p-3 text-right">Qté</th><th className="p-3 text-right">Livré</th><th className="p-3 text-right">Total</th></tr></thead><tbody>{(selected?.items || []).map((line, i) => <tr key={line.id || i} className="border-t border-white/[.055]"><td className="p-3 text-zinc-300">{line.itemName || `Article ${line.itemId}`}</td><td className="p-3 text-right">{number(line.quantity)}</td><td className="p-3 text-right text-emerald-400">{number(line.deliveredQuantity || 0)}</td><td className="p-3 text-right font-semibold">{currency(line.total || 0)}</td></tr>)}</tbody></table></div>
      {!!selected?.payments?.length && <div className="mt-4"><p className="label">Paiements</p><div className="divide-y divide-white/[.055] rounded-xl border border-white/[.07]">{selected.payments.map((payment) => <div key={payment.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"><span className={payment.cancelledAt ? 'text-zinc-600 line-through' : 'text-zinc-300'}>{date(payment.paymentDate, true)} · {payment.method || 'Moyen non précisé'}</span><span className={payment.cancelledAt ? 'text-zinc-600 line-through' : 'font-semibold text-emerald-400'}>{currency(payment.amount)}</span></div>)}</div></div>}
      {selected?.notes && <div className="mt-4 rounded-xl bg-white/[.025] p-4"><p className="label">Notes</p><p className="whitespace-pre-line text-sm text-zinc-400">{selected.notes}</p></div>}
      {selected && !['Livrée','Annulée'].includes(selected.status) && <div className="mt-5 flex flex-wrap justify-end gap-2">{can('orders.update') && selected.status === 'Brouillon' && <Button variant="secondary" onClick={() => void changeStatus(selected, 'En attente')}><Check className="h-4 w-4" />Mettre en attente</Button>}{can('orders.update') && ['Brouillon','En attente'].includes(selected.status) && <Button variant="secondary" onClick={() => void changeStatus(selected, 'Confirmée')}><Check className="h-4 w-4" />Confirmer</Button>}{['Confirmée','Partiellement livrée'].includes(selected.status) && can('deliveries.create') && <Button onClick={() => void deliverAll(selected)}><PackageCheck className="h-4 w-4" />Livrer le solde</Button>}{can('orders.cancel') && <Button variant="danger" onClick={() => void cancelOrder(selected)}><XCircle className="h-4 w-4" />Annuler la vente</Button>}</div>}</div></Modal>
  </div>;
}
