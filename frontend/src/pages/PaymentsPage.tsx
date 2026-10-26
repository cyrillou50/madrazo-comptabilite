import { useMemo, useState } from 'react';
import { Ban, Clock3, HandCoins, Plus, Receipt, Tags, WalletCards } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api, ApiError } from '../lib/api';
import { useApi } from '../hooks/useApi';
import type { Order, Payment } from '../types';
import { currency, currencySymbol, date, number } from '../lib/format';
import { listOf } from '../lib/data';
import { Badge, Button, ErrorState, FormActions, Input, LoadingState, Modal, PageHeader, Panel, SearchField, Select, Textarea } from '../components/ui';
import { DataTable } from '../components/DataTable';
import { CategoryManager, type ManagedCategory } from '../components/CategoryManager';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { useConfirm } from '../contexts/ConfirmContext';

const schema = z.object({ orderId: z.string().min(1, 'Sélectionnez une commande.'), amount: z.coerce.number<number>().positive('Le montant doit être positif.'), paymentMethodId: z.string().optional(), notes: z.string().optional() });
type FormData = z.infer<typeof schema>;

export function PaymentsPage() {
  const [tab, setTab] = useState<'debts' | 'history'>('debts'); const [search, setSearch] = useState(''); const [age, setAge] = useState(''); const [paying, setPaying] = useState<Order | null | undefined>(); const [methodsOpen, setMethodsOpen] = useState(false);
  const { can, preferences } = useAuth();
  const debtsQuery = useApi<any>('/payments/debts', { search, age, pageSize: 100 }); const historyQuery = useApi<any>('/payments', { search, pageSize: 100 }); const methodsQuery = useApi<any>('/payment-methods');
  const debts = useMemo(() => listOf<Order>(debtsQuery.data), [debtsQuery.data]); const payments = useMemo(() => listOf<Payment>(historyQuery.data), [historyQuery.data]); const methods = useMemo(() => listOf<ManagedCategory>(methodsQuery.data), [methodsQuery.data]);
  const { notify } = useToast(); const { prompt } = useConfirm();
  const { register, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: { orderId: '', amount: 0, paymentMethodId: '', notes: '' } });
  const warningDays = preferences.debtWarningDays;
  const ageOptions = [...new Set([7, warningDays, 30, 60])].sort((a, b) => a - b);

  // La plupart des règlements se font en argent sale : ce moyen est proposé par défaut.
  function openPayment(order: Order | null) { const defaultMethod = methods.find((method) => method.isDirty) ?? methods[0]; setPaying(order); reset({ orderId: order ? String(order.id) : '', amount: order?.remainingAmount || 0, paymentMethodId: defaultMethod ? String(defaultMethod.id) : '', notes: '' }); }
  async function submit(values: FormData) { try { await api.post('/payments', { orderId: values.orderId, paymentMethodId: values.paymentMethodId || null, notes: values.notes, amountCents: Math.round(values.amount * 100) }); notify('Paiement enregistré. La dette a été recalculée.'); setPaying(undefined); debtsQuery.reload(); historyQuery.reload(); } catch (reason) { notify(reason instanceof ApiError ? reason.message : 'Paiement impossible.', 'error'); } }
  async function cancelPayment(payment: Payment) {
    const reason = await prompt({ title: `Annuler ce paiement de ${currency(payment.amount)} ?`, message: `Commande ${payment.orderReference}. Le solde dû sera recalculé ; le paiement reste visible dans l’historique.`, label: 'Motif de l’annulation', minLength: 3, confirmLabel: 'Annuler le paiement' });
    if (!reason) return;
    try { await api.post(`/payments/${payment.id}/reverse`, { reason }); notify('Paiement annulé et solde recalculé.'); historyQuery.reload(); debtsQuery.reload(); } catch (error) { notify(error instanceof ApiError ? error.message : 'Annulation impossible.', 'error'); }
  }
  const totalDebt = debts.reduce((sum, order) => sum + (order.remainingAmount || 0), 0); const oldDebts = debts.filter((order) => (Date.now() - new Date(order.orderDate).getTime()) / 86400000 > warningDays).length;

  return <div className="animate-enter"><PageHeader eyebrow="Recouvrement" title="Dettes & paiements" description="Suivez les soldes ouverts et enregistrez chaque règlement sans dépasser le montant dû." action={<div className="flex flex-wrap gap-2">{can('settings.write') && <Button variant="secondary" onClick={() => setMethodsOpen(true)}><Tags className="h-4 w-4" />Moyens de paiement</Button>}{can('payments.create') && <Button onClick={() => openPayment(null)}><Plus className="h-4 w-4" />Nouveau paiement</Button>}</div>} />
    <div className="mb-4 grid gap-3 sm:grid-cols-3"><Panel className="p-4"><p className="label">Dette totale</p><p className="mt-1 text-2xl font-bold text-amber-400">{currency(totalDebt)}</p></Panel><Panel className="p-4"><p className="label">Commandes à solder</p><p className="mt-1 text-2xl font-bold">{number(debts.length)}</p></Panel><Panel className="p-4"><p className="label">Dettes de plus de {number(warningDays)} jours</p><p className="mt-1 text-2xl font-bold text-red-400">{number(oldDebts)}</p></Panel></div>
    <Panel className="overflow-hidden"><div className="flex flex-col gap-3 border-b border-white/[.07] p-4 lg:flex-row lg:items-center"><div className="flex rounded-xl border border-white/[.07] bg-ink-950/70 p-1"><button onClick={() => setTab('debts')} className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${tab === 'debts' ? 'bg-white/[.08] text-white' : 'text-zinc-600'}`}>Dettes en cours</button><button onClick={() => setTab('history')} className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${tab === 'history' ? 'bg-white/[.08] text-white' : 'text-zinc-600'}`}>Historique des paiements</button></div><SearchField value={search} onChange={setSearch} placeholder="Groupe ou référence…" />{tab === 'debts' && <Select aria-label="Ancienneté" value={age} onChange={(e) => setAge(e.target.value)} className="lg:w-48"><option value="">Toute ancienneté</option>{ageOptions.map((days) => <option key={days} value={days}>Plus de {days} jours</option>)}</Select>}</div>
      {tab === 'debts' ? debtsQuery.loading ? <LoadingState /> : debtsQuery.error ? <ErrorState message={debtsQuery.error} retry={debtsQuery.reload} /> : <DataTable<Order> rows={debts} rowKey={(o) => o.id} emptyTitle="Aucune dette ouverte" emptyDescription="Toutes les commandes enregistrées sont soldées." columns={[
        { key: 'order', label: 'Commande', render: (o) => <div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-amber-500/[.08] text-amber-400"><Clock3 className="h-4 w-4" /></span><div><p className="font-mono text-xs font-bold text-zinc-200">{o.reference}</p><p className="text-[10px] text-zinc-600">{date(o.orderDate)}</p></div></div> }, { key: 'buyer', label: 'Débiteur', render: (o) => o.groupName || 'Indépendant' }, { key: 'total', label: 'Facturé', className: 'text-right', render: (o) => currency(o.totalAmount) }, { key: 'paid', label: 'Encaissé', className: 'text-right', render: (o) => <span className="text-emerald-400">{currency(o.paidAmount || 0)}</span> }, { key: 'remaining', label: 'Reste dû', className: 'text-right', render: (o) => <span className="font-bold text-amber-400">{currency(o.remainingAmount || 0)}</span> }, { key: 'status', label: 'État', render: (o) => <Badge>{o.paymentStatus}</Badge> }, { key: 'action', label: '', render: (o) => can('payments.create') ? <Button size="sm" onClick={() => openPayment(o)}><HandCoins className="h-4 w-4" />Encaisser</Button> : null },
      ]} /> : historyQuery.loading ? <LoadingState /> : historyQuery.error ? <ErrorState message={historyQuery.error} retry={historyQuery.reload} /> : <DataTable<Payment> rows={payments} rowKey={(p) => p.id} emptyTitle="Aucun paiement" emptyDescription="Les règlements enregistrés apparaîtront ici." columns={[
        { key: 'date', label: 'Date', render: (p) => <div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-500/[.08] text-emerald-400"><Receipt className="h-4 w-4" /></span><span className="text-xs text-zinc-400">{date(p.paymentDate, true)}</span></div> }, { key: 'ref', label: 'Commande', render: (p) => <span className="font-mono text-xs">{p.orderReference}</span> }, { key: 'group', label: 'Groupe', render: (p) => p.groupName || '—' }, { key: 'method', label: 'Moyen', render: (p) => p.method || '—' }, { key: 'amount', label: 'Montant', className: 'text-right', render: (p) => <span className={p.cancelledAt ? 'line-through text-zinc-600' : 'font-bold text-emerald-400'}>{currency(p.amount)}</span> }, { key: 'state', label: 'État', render: (p) => <Badge tone={p.cancelledAt ? 'danger' : 'success'}>{p.cancelledAt ? 'Annulé' : 'Validé'}</Badge> }, { key: 'action', label: '', render: (p) => can('payments.cancel') && !p.cancelledAt ? <Button variant="ghost" size="sm" onClick={() => void cancelPayment(p)}><Ban className="h-4 w-4" />Annuler</Button> : null },
      ]} />}
    </Panel>
    <Modal open={paying !== undefined} onClose={() => setPaying(undefined)} title="Enregistrer un paiement" description="Le serveur refusera tout montant supérieur au solde dû."><form onSubmit={handleSubmit(submit)} className="p-5"><div className="space-y-4">
      <Select label="Commande à solder" {...register('orderId', { onChange: (e) => { const order = debts.find((o) => String(o.id) === e.target.value); if (order) setValue('amount', order.remainingAmount || 0); } })} error={errors.orderId?.message}><option value="">Sélectionner…</option>{debts.map((o) => <option key={o.id} value={o.id}>{o.reference} — {o.groupName || 'Indépendant'} — reste {currency(o.remainingAmount || 0)}</option>)}</Select>
      <Input label={`Montant reçu (${currencySymbol()})`} type="number" min="1" step="1" {...register('amount')} error={errors.amount?.message} />
      <Select label="Moyen de paiement" {...register('paymentMethodId')} hint={!methods.length ? (can('settings.write') ? <button type="button" className="font-semibold text-blood-400 hover:text-blood-300" onClick={() => setMethodsOpen(true)}>Créer vos moyens de paiement</button> : 'Aucun moyen de paiement configuré.') : undefined}>{!methods.length && <option value="">Non précisé</option>}{methods.map((method) => <option key={method.id} value={method.id}>{method.name}{method.isDirty && !/sale/i.test(method.name) ? ' (argent sale)' : ''}</option>)}</Select>
      <Textarea label="Notes sur le règlement" {...register('notes')} />
    </div><div className="mt-4 flex gap-3 rounded-xl border border-sky-500/10 bg-sky-500/[.035] p-3 text-xs leading-relaxed text-zinc-500"><WalletCards className="h-5 w-5 shrink-0 text-sky-400" />Les paiements sont journalisés. Une erreur se corrige par une annulation, jamais par une suppression.</div><FormActions cancel={() => setPaying(undefined)} submitting={isSubmitting} submitLabel="Enregistrer le paiement" /></form></Modal>
    <CategoryManager open={methodsOpen} onClose={() => setMethodsOpen(false)} onChanged={() => { methodsQuery.reload(); historyQuery.reload(); }} kind="payment-methods" />
  </div>;
}
