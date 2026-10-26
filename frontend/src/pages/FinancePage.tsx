import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ArrowDownLeft, ArrowUpRight, Ban, Download, FileSpreadsheet, PiggyBank, Plus, ReceiptText, Scale, Tags, WalletCards, WashingMachine } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api, apiBaseUrl, ApiError, asData } from '../lib/api';
import { useApi } from '../hooks/useApi';
import type { DashboardData, Fund, FundBalances, LedgerEntry } from '../types';
import { currency, currencySymbol, date } from '../lib/format';
import { listOf, metaOf } from '../lib/data';
import { fundLabels, launderedAmount, launderingFee } from '../lib/treasury';
import { Badge, Button, ErrorState, FormActions, Input, LoadingState, Modal, PageHeader, Panel, SearchField, Select, Textarea } from '../components/ui';
import { DataTable } from '../components/DataTable';
import { CategoryManager, type ManagedCategory } from '../components/CategoryManager';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { useConfirm } from '../contexts/ConfirmContext';

const schema = z.object({ label: z.string().trim().min(2, 'Le libellé est obligatoire.'), categoryId: z.string().min(1, 'Choisissez une catégorie.'), amount: z.coerce.number<number>().positive('Le montant doit être positif.'), fund: z.enum(['clean', 'dirty']), expenseDate: z.string().min(1, 'La date est obligatoire.'), notes: z.string().optional() });
type FormData = z.infer<typeof schema>;
const today = () => new Date().toISOString().slice(0, 10);
const toCents = (value: number) => Math.round(value * 100);

async function downloadReport(format: 'csv' | 'xlsx', notify: (message: string, tone?: 'success' | 'error') => void, from: string, to: string) {
  try { const query = new URLSearchParams(); if (from) query.set('from', from); if (to) query.set('to', to); const response = await fetch(`${apiBaseUrl}/finances/export.${format}${query.size ? `?${query}` : ''}`, { credentials: 'include' }); if (!response.ok) throw new Error(); const blob = await response.blob(); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `finances-madrazo-${new Date().toISOString().slice(0,10)}.${format}`; a.click(); URL.revokeObjectURL(url); notify(`Export ${format.toUpperCase()} généré.`); } catch { notify('Export indisponible.', 'error'); }
}

function FundBadge({ fund }: { fund: Fund }) {
  return <Badge tone={fund === 'dirty' ? 'warning' : 'success'}>{fundLabels[fund]}</Badge>;
}

/** Argent ajouté par les membres eux-mêmes, dans la caisse choisie. */
function DepositDialog({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const { user } = useAuth(); const { notify } = useToast();
  const [fund, setFund] = useState<Fund>('dirty'); const [amount, setAmount] = useState(''); const [label, setLabel] = useState(''); const [notes, setNotes] = useState(''); const [day, setDay] = useState('');
  const [error, setError] = useState<string | null>(null); const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) { setFund('dirty'); setAmount(''); setLabel(`Apport de ${user?.displayName ?? ''}`.trim()); setNotes(''); setDay(''); setError(null); } }, [open, user?.displayName]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    const value = Number(amount);
    if (!(value > 0)) { setError('Indiquez un montant positif.'); return; }
    if (label.trim().length < 2) { setError('Le libellé est obligatoire.'); return; }
    setSaving(true);
    try {
      await api.post('/treasury/deposits', { fund, amountCents: toCents(value), label: label.trim(), notes: notes.trim() || null, occurredAt: day || undefined });
      notify(`${currency(value)} ajoutés en ${fundLabels[fund].toLowerCase()}.`); onDone(); onClose();
    } catch (reason) { setError(reason instanceof ApiError ? reason.message : 'Ajout impossible.'); }
    finally { setSaving(false); }
  }
  return <Modal open={open} onClose={onClose} title="Ajouter de l’argent" description="Argent que vous mettez vous-mêmes dans la caisse : il s’ajoute au solde choisi.">
    <form onSubmit={submit} className="space-y-4 p-5">
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Caisse">{(['dirty', 'clean'] as const).map((value) => <button key={value} type="button" role="radio" aria-checked={fund === value} onClick={() => setFund(value)} className={`rounded-xl border p-3 text-left text-sm transition ${fund === value ? (value === 'dirty' ? 'border-amber-500/40 bg-amber-500/10 text-amber-200' : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200') : 'border-white/[.07] bg-white/[.02] text-zinc-400 hover:bg-white/[.05]'}`}><span className="block font-semibold">{fundLabels[value]}</span><span className="mt-0.5 block text-xs opacity-70">{value === 'dirty' ? 'À blanchir ensuite' : 'Utilisable directement'}</span></button>)}</div>
      <Input label={`Montant (${currencySymbol()})`} type="number" min="1" step="1" value={amount} onChange={(event) => setAmount(event.target.value)} required autoFocus />
      <Input label="Libellé" value={label} onChange={(event) => setLabel(event.target.value)} maxLength={200} required />
      <Input label="Date (facultative)" type="date" value={day} onChange={(event) => setDay(event.target.value)} hint="Laissez vide pour maintenant." />
      <Textarea label="Notes" value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={500} />
      {error && <p role="alert" className="rounded-xl border border-red-500/20 bg-red-500/[.07] px-3.5 py-3 text-sm text-red-300">{error}</p>}
      <FormActions cancel={onClose} submitting={saving} submitLabel="Ajouter l’argent" />
    </form>
  </Modal>;
}

/** Blanchiment : l'argent sale engagé devient de l'argent propre, commission déduite. */
function LaunderingDialog({ open, onClose, onDone, availableDirty }: { open: boolean; onClose: () => void; onDone: () => void; availableDirty: number }) {
  const { preferences } = useAuth(); const { notify } = useToast();
  const [dirty, setDirty] = useState(''); const [fee, setFee] = useState(''); const [clean, setClean] = useState(''); const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null); const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) { setDirty(''); setFee(String(preferences.launderingFeePercent)); setClean(''); setNotes(''); setError(null); } }, [open, preferences.launderingFeePercent]);
  function changeDirty(value: string) { setDirty(value); setClean(value ? String(launderedAmount(Number(value), Number(fee))) : ''); }
  function changeFee(value: string) { setFee(value); if (dirty) setClean(String(launderedAmount(Number(dirty), Number(value)))); }
  function changeClean(value: string) { setClean(value); if (dirty && value) setFee(String(launderingFee(Number(dirty), Number(value)))); }
  const dirtyValue = Number(dirty) || 0; const cleanValue = Number(clean) || 0; const commission = Math.max(0, dirtyValue - cleanValue);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!(dirtyValue > 0)) { setError('Indiquez le montant d’argent sale à blanchir.'); return; }
    if (dirtyValue > availableDirty) { setError(`Il n’y a que ${currency(availableDirty)} d’argent sale disponible.`); return; }
    if (!(cleanValue > 0) || cleanValue > dirtyValue) { setError('L’argent propre obtenu doit être positif et ne pas dépasser l’argent sale engagé.'); return; }
    setSaving(true);
    try {
      await api.post('/treasury/laundering', { dirtyAmountCents: toCents(dirtyValue), cleanAmountCents: toCents(cleanValue), notes: notes.trim() || null });
      notify(`${currency(dirtyValue)} blanchis : ${currency(cleanValue)} d’argent propre ajoutés.`); onDone(); onClose();
    } catch (reason) { setError(reason instanceof ApiError ? reason.message : 'Blanchiment impossible.'); }
    finally { setSaving(false); }
  }
  return <Modal open={open} onClose={onClose} title="Blanchir de l’argent" description="L’argent sale engagé sort de la caisse sale ; l’argent propre obtenu entre dans la caisse propre.">
    <form onSubmit={submit} className="space-y-4 p-5">
      <div className="flex items-center justify-between rounded-xl border border-amber-500/15 bg-amber-500/[.05] p-3 text-sm"><span className="text-zinc-400">Argent sale disponible</span><span className="font-bold text-amber-300">{currency(availableDirty)}</span></div>
      <Input label={`Argent sale à blanchir (${currencySymbol()})`} type="number" min="1" step="1" value={dirty} onChange={(event) => changeDirty(event.target.value)} required autoFocus hint={availableDirty > 0 ? <button type="button" className="font-semibold text-blood-400 hover:text-blood-300" onClick={() => changeDirty(String(availableDirty))}>Tout blanchir</button> : undefined} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Commission (%)" type="number" min="0" max="99" step="0.01" value={fee} onChange={(event) => changeFee(event.target.value)} />
        <Input label={`Argent propre obtenu (${currencySymbol()})`} type="number" min="1" step="1" value={clean} onChange={(event) => changeClean(event.target.value)} required />
      </div>
      <div className="grid grid-cols-3 gap-2 rounded-xl border border-white/[.07] bg-white/[.02] p-3 text-center text-xs"><div><p className="text-zinc-600">Sort de l’argent sale</p><p className="mt-1 font-bold text-amber-300">−{currency(dirtyValue)}</p></div><div><p className="text-zinc-600">Entre en argent propre</p><p className="mt-1 font-bold text-emerald-300">+{currency(cleanValue)}</p></div><div><p className="text-zinc-600">Commission</p><p className="mt-1 font-bold text-red-300">{currency(commission)}</p></div></div>
      <Textarea label="Notes" placeholder="Ex. : via le garage, contact…" value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={500} />
      {error && <p role="alert" className="rounded-xl border border-red-500/20 bg-red-500/[.07] px-3.5 py-3 text-sm text-red-300">{error}</p>}
      <FormActions cancel={onClose} submitting={saving} submitLabel="Blanchir" />
    </form>
  </Modal>;
}

export function FinancePage() {
  const [from, setFrom] = useState(''); const [to, setTo] = useState(''); const [fund, setFund] = useState(''); const [search, setSearch] = useState(''); const [page, setPage] = useState(1);
  const [expenseOpen, setExpenseOpen] = useState(false); const [categoriesOpen, setCategoriesOpen] = useState(false); const [depositOpen, setDepositOpen] = useState(false); const [launderOpen, setLaunderOpen] = useState(false);
  const { can, preferences } = useAuth(); const { notify } = useToast(); const { prompt } = useConfirm();
  const canTreasury = can('treasury.write');
  const balancesQuery = useApi<FundBalances>('/treasury/balances');
  const dashboardQuery = useApi<DashboardData>(can('dashboard.read') ? '/dashboard' : null, { from, to });
  const ledgerQuery = useApi<any>('/finances/ledger', { from, to, fund, search, page, pageSize: preferences.defaultPageSize });
  const categoriesQuery = useApi<any>('/expense-categories');
  const ledger = useMemo(() => listOf<LedgerEntry>(ledgerQuery.data), [ledgerQuery.data]); const ledgerMeta = metaOf(ledgerQuery.data);
  const categories = useMemo(() => listOf<ManagedCategory>(categoriesQuery.data), [categoriesQuery.data]);
  const balances = asData<FundBalances | null>(balancesQuery.data);
  const dirtyBalance = (balances?.dirtyCents ?? 0) / 100; const cleanBalance = (balances?.cleanCents ?? 0) / 100;
  const totals = dashboardQuery.data?.totals;
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: { label: '', categoryId: '', amount: 0, fund: 'clean', expenseDate: today(), notes: '' } });

  function refreshAll() { balancesQuery.reload(); ledgerQuery.reload(); dashboardQuery.reload(); }
  function openExpense() { reset({ label: '', categoryId: '', amount: 0, fund: 'clean', expenseDate: today(), notes: '' }); setExpenseOpen(true); }
  async function submit(values: FormData) { try { await api.post('/expenses', { label: values.label, categoryId: values.categoryId, fund: values.fund, notes: values.notes, expenseDate: values.expenseDate, amountCents: toCents(values.amount) }); notify('Dépense enregistrée.'); setExpenseOpen(false); refreshAll(); } catch (reason) { notify(reason instanceof ApiError ? reason.message : 'Enregistrement impossible.', 'error'); } }
  async function reverse(entry: LedgerEntry) {
    const isExpense = entry.sourceType === 'expense';
    const what = isExpense ? `la dépense « ${entry.label} »` : entry.sourceType === 'deposit' ? `l’apport « ${entry.label} »` : 'ce blanchiment';
    const reason = await prompt({ title: `Annuler ${what} ?`, message: 'Des mouvements inverses rétablissent les soldes ; l’opération reste visible dans le registre.', label: 'Motif de l’annulation', minLength: 3, confirmLabel: 'Annuler l’opération' });
    if (!reason) return;
    try { await api.post(isExpense ? `/expenses/${entry.sourceId}/reverse` : `/treasury/${entry.sourceId}/reverse`, { reason }); notify('Opération annulée et soldes recalculés.'); refreshAll(); }
    catch (error) { notify(error instanceof ApiError ? error.message : 'Annulation impossible.', 'error'); }
  }
  const canReverse = (entry: LedgerEntry) => !entry.reversed && ((entry.sourceType === 'expense' && can('expenses.write')) || ((entry.sourceType === 'deposit' || entry.sourceType === 'laundering_out') && canTreasury));

  return <div className="animate-enter"><PageHeader eyebrow="Registre financier" title="Finances & trésorerie" description="Suivez l’argent propre et l’argent sale, ajoutez vos apports et blanchissez." action={<div className="flex flex-wrap gap-2">{can('payments.read') && <><Button variant="secondary" onClick={() => void downloadReport('csv', notify, from, to)}><Download className="h-4 w-4" />CSV</Button><Button variant="secondary" onClick={() => void downloadReport('xlsx', notify, from, to)}><FileSpreadsheet className="h-4 w-4" />Excel</Button></>}{can('expenses.write') && <Button variant="secondary" onClick={() => setCategoriesOpen(true)}><Tags className="h-4 w-4" />Catégories de dépenses</Button>}{can('expenses.create') && <Button variant="secondary" onClick={openExpense}><Plus className="h-4 w-4" />Nouvelle dépense</Button>}{canTreasury && <Button variant="secondary" onClick={() => setDepositOpen(true)}><PiggyBank className="h-4 w-4" />Ajouter de l’argent</Button>}{canTreasury && <Button onClick={() => setLaunderOpen(true)}><WashingMachine className="h-4 w-4" />Blanchir</Button>}</div>} />

    <div className="mb-4 grid gap-3 sm:grid-cols-3">
      <Panel className="p-4"><div className="flex items-center justify-between"><p className="label">Argent propre</p><WalletCards className="h-4 w-4 text-emerald-400" /></div><p className="mt-1 text-2xl font-bold text-emerald-300">{balancesQuery.loading && !balances ? '…' : currency(cleanBalance)}</p><p className="mt-1 text-[11px] text-zinc-600">Utilisable directement</p></Panel>
      <Panel className="p-4"><div className="flex items-center justify-between"><p className="label">Argent sale</p><WashingMachine className="h-4 w-4 text-amber-400" /></div><p className="mt-1 text-2xl font-bold text-amber-300">{balancesQuery.loading && !balances ? '…' : currency(dirtyBalance)}</p><p className="mt-1 text-[11px] text-zinc-600">{canTreasury && dirtyBalance > 0 ? <button type="button" className="font-semibold text-blood-400 hover:text-blood-300" onClick={() => setLaunderOpen(true)}>Blanchir maintenant</button> : 'À blanchir avant usage'}</p></Panel>
      <Panel className="p-4"><div className="flex items-center justify-between"><p className="label">Total en caisse</p><Scale className="h-4 w-4 text-sky-400" /></div><p className="mt-1 text-2xl font-bold">{balancesQuery.loading && !balances ? '…' : currency(cleanBalance + dirtyBalance)}</p><p className="mt-1 text-[11px] text-zinc-600">Propre et sale confondus</p></Panel>
    </div>
    {balancesQuery.error && <Panel className="mb-4"><ErrorState message={balancesQuery.error} retry={balancesQuery.reload} /></Panel>}

    <Panel className="mb-4 flex flex-wrap items-end gap-3 p-4"><Input label="Du" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className="w-44" /><Input label="Au" type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} className="w-44" /><p className="pb-2 text-xs text-zinc-600">Les indicateurs de la période et le registre respectent ces dates.</p></Panel>
    {can('dashboard.read') && (dashboardQuery.loading ? <LoadingState /> : dashboardQuery.error ? <Panel><ErrorState message={dashboardQuery.error} retry={dashboardQuery.reload} /></Panel> : <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Panel className="p-4"><div className="flex items-center justify-between"><p className="label">Facturé</p><ReceiptText className="h-4 w-4 text-zinc-600" /></div><p className="mt-1 text-xl font-bold">{currency(totals?.revenue || 0)}</p></Panel><Panel className="p-4"><div className="flex items-center justify-between"><p className="label">Encaissé</p><ArrowDownLeft className="h-4 w-4 text-emerald-400" /></div><p className="mt-1 text-xl font-bold text-emerald-400">{currency(totals?.received || 0)}</p></Panel><Panel className="p-4"><div className="flex items-center justify-between"><p className="label">Dépensé</p><ArrowUpRight className="h-4 w-4 text-red-400" /></div><p className="mt-1 text-xl font-bold text-red-400">{currency(totals?.expenses || 0)}</p></Panel><Panel className="p-4"><div className="flex items-center justify-between"><p className="label">Bénéfice brut</p><Scale className="h-4 w-4 text-sky-400" /></div><p className="mt-1 text-xl font-bold text-sky-300">{currency(totals?.grossProfit || 0)}</p></Panel></div>)}

    <Panel className="mt-4 overflow-hidden"><div className="flex flex-col gap-3 border-b border-white/[.07] p-4 sm:flex-row sm:items-center"><div className="min-w-0 sm:mr-auto"><h2 className="font-semibold text-zinc-100">Registre de caisse</h2><p className="mt-1 text-xs text-zinc-600">Chaque entrée et sortie d’argent, avec sa caisse</p></div><SearchField value={search} onChange={(value) => { setSearch(value); setPage(1); }} placeholder="Rechercher un libellé…" /><Select aria-label="Caisse" value={fund} onChange={(event) => { setFund(event.target.value); setPage(1); }} className="sm:w-48"><option value="">Toutes les caisses</option><option value="clean">Argent propre</option><option value="dirty">Argent sale</option></Select></div>
      {ledgerQuery.loading ? <LoadingState /> : ledgerQuery.error ? <ErrorState message={ledgerQuery.error} retry={ledgerQuery.reload} /> : <DataTable<LedgerEntry> rows={ledger} rowKey={(entry) => entry.id} page={ledgerMeta?.page || page} totalPages={ledgerMeta?.totalPages} onPage={setPage} emptyTitle="Aucun mouvement" emptyDescription="Aucune entrée ni sortie d’argent sur cette période." columns={[
        { key: 'date', label: 'Date', render: (entry) => <span className="whitespace-nowrap text-xs text-zinc-500">{date(entry.occurredAt, true)}</span> },
        { key: 'label', label: 'Opération', render: (entry) => <div className="flex items-center gap-3"><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${entry.amount >= 0 ? 'bg-emerald-500/[.08] text-emerald-400' : 'bg-red-500/[.08] text-red-400'}`}>{entry.amount >= 0 ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}</span><div className="min-w-0"><p className="flex flex-wrap items-center gap-2 font-medium text-zinc-300">{entry.label}{entry.reversed && <Badge tone="neutral">Annulé</Badge>}</p><p className="text-[11px] text-zinc-600">{entry.typeLabel}{entry.userName ? ` · ${entry.userName}` : ''}</p></div></div> },
        { key: 'fund', label: 'Caisse', render: (entry) => <FundBadge fund={entry.fund} /> },
        { key: 'amount', label: 'Montant', className: 'text-right', render: (entry) => <span className={`font-bold ${entry.reversed ? 'text-zinc-600 line-through' : entry.amount >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{entry.amount >= 0 ? '+' : '−'}{currency(Math.abs(entry.amount))}</span> },
        { key: 'actions', label: '', render: (entry) => canReverse(entry) ? <Button variant="ghost" size="sm" aria-label={`Annuler : ${entry.label}`} onClick={() => void reverse(entry)}><Ban className="h-4 w-4" /></Button> : null },
      ]} />}
    </Panel>

    <Modal open={expenseOpen} onClose={() => setExpenseOpen(false)} title="Nouvelle dépense" description="L’écriture sera ajoutée au registre de caisse."><form onSubmit={handleSubmit(submit)} className="p-5"><div className="space-y-4"><Input label="Libellé" {...register('label')} error={errors.label?.message} /><Select label="Catégorie" {...register('categoryId')} error={errors.categoryId?.message} hint={!categories.length && can('expenses.write') ? <button type="button" className="font-semibold text-blood-400 hover:text-blood-300" onClick={() => setCategoriesOpen(true)}>Créer une catégorie de dépenses</button> : undefined}><option value="">Sélectionner…</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</Select><Input label={`Montant (${currencySymbol()})`} type="number" min="1" step="1" {...register('amount')} error={errors.amount?.message} /><Select label="Payée avec" {...register('fund')}><option value="clean">Argent propre</option><option value="dirty">Argent sale</option></Select><Input label="Date" type="date" {...register('expenseDate')} error={errors.expenseDate?.message} /><Textarea label="Justification / notes" {...register('notes')} /></div><FormActions cancel={() => setExpenseOpen(false)} submitting={isSubmitting} submitLabel="Enregistrer la dépense" /></form></Modal>
    <DepositDialog open={depositOpen} onClose={() => setDepositOpen(false)} onDone={refreshAll} />
    <LaunderingDialog open={launderOpen} onClose={() => setLaunderOpen(false)} onDone={refreshAll} availableDirty={dirtyBalance} />
    <CategoryManager open={categoriesOpen} onClose={() => setCategoriesOpen(false)} onChanged={() => { categoriesQuery.reload(); ledgerQuery.reload(); }} kind="expense-categories" />
  </div>;
}
