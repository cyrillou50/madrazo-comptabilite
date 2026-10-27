import { useMemo, useState, type ReactNode } from 'react';
import { addDays, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, LabelList, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import {
  ArrowDownRight, ArrowRight, ArrowUpRight, Banknote, Boxes, CircleDollarSign, Clock3, HandCoins,
  PackageX, PiggyBank, ReceiptText, ShoppingBag, Table, TrendingUp, UsersRound, WalletCards, WashingMachine,
  type LucideIcon,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../contexts/AuthContext';
import { currency, date, number } from '../lib/format';
import { fundColors, fundLabels } from '../lib/treasury';
import type { DashboardData, Item, Order } from '../types';
import { Badge, ErrorState, LoadingState, PageHeader, Panel, Select } from '../components/ui';
import { DataTable } from '../components/DataTable';

const EMPTY: DashboardData = {
  totals: { received: 0, revenue: 0, grossProfit: 0, expenses: 0, cashBalance: 0, outstandingDebt: 0, salesCount: 0, groupsCount: 0, contactsCount: 0, pendingOrders: 0, lowStockItems: 0 },
  salesTrend: [], salesByItem: [], activeGroups: [], topItems: [], recentOrders: [], lowStock: [],
};

// Graphiques : marques fines, grille en filet plein, textes dans les tons neutres ; la couleur ne porte que l'identité.
const SURFACE = '#111416';
const GRID = 'rgba(255,255,255,.045)';
const AXIS = '#52525b';
const SALES = '#c52a32';
const CONTEXT = '#a1a1aa';
const tooltipStyle = { background: '#121518', border: '1px solid rgba(255,255,255,.09)', borderRadius: 12, color: '#e4e4e7', fontSize: 12 };
const compact = new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 }).format;
const percent = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format;

function dayLabel(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : format(parsed, 'dd MMM', { locale: fr });
}

function StatCard({ label, value, caption, icon: Icon, tone = 'neutral', marker }: { label: string; value: string; caption: ReactNode; icon: LucideIcon; tone?: 'positive' | 'negative' | 'warning' | 'neutral'; marker?: string }) {
  return <Panel className="group relative overflow-hidden p-5 transition hover:-translate-y-0.5 hover:border-white/[.12]">
    <span className={`absolute -right-5 -top-5 h-24 w-24 rounded-full blur-2xl ${tone === 'positive' ? 'bg-emerald-500/10' : tone === 'negative' ? 'bg-red-500/10' : tone === 'warning' ? 'bg-amber-500/10' : 'bg-blood-500/[.07]'}`} />
    <div className="relative flex items-start justify-between gap-3"><div className="min-w-0"><p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[.16em] text-zinc-600">{marker && <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={{ background: marker }} />}{label}</p><p className="mt-2 text-xl font-bold tracking-tight text-zinc-100 sm:text-2xl">{value}</p><div className={`mt-2 flex items-center gap-1 text-[11px] ${tone === 'positive' ? 'text-emerald-400' : tone === 'negative' ? 'text-red-400' : tone === 'warning' ? 'text-amber-400' : 'text-zinc-600'}`}>{tone === 'positive' ? <ArrowUpRight className="h-3.5 w-3.5 shrink-0" /> : tone === 'negative' ? <ArrowDownRight className="h-3.5 w-3.5 shrink-0" /> : null}<span className="min-w-0">{caption}</span></div></div><span className="rounded-xl border border-white/[.06] bg-white/[.035] p-2.5 text-zinc-500 transition group-hover:text-blood-400"><Icon className="h-5 w-5" /></span></div>
  </Panel>;
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="mb-3 mt-6 px-1 text-[10px] font-bold uppercase tracking-[.22em] text-zinc-600 first:mt-0">{children}</h2>;
}

interface LegendItem { label: string; color: string; value?: string; shape?: 'line' | 'dashed' | 'square' }

/** Légende toujours présente dès deux séries : pastille colorée, texte en tons neutres. */
function ChartLegend({ items }: { items: LegendItem[] }) {
  return <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-zinc-400">{items.map((item) => <li key={item.label} className="flex items-center gap-2">
    <span aria-hidden="true" className={item.shape === 'square' ? 'h-2.5 w-2.5 rounded-sm' : 'h-[3px] w-4 rounded-full'} style={item.shape === 'dashed' ? { backgroundImage: `linear-gradient(90deg, ${item.color} 55%, transparent 55%)`, backgroundSize: '6px 3px' } : { background: item.color }} />
    <span>{item.label}</span>{item.value && <span className="font-semibold text-zinc-200">{item.value}</span>}
  </li>)}</ul>;
}

function MiniTable({ headers, rows }: { headers: string[]; rows: ReactNode[][] }) {
  if (!rows.length) return <p className="py-10 text-center text-sm text-zinc-600">Aucune donnée sur cette période</p>;
  return <table className="w-full text-left text-xs"><thead className="sticky top-0 bg-ink-850 text-[10px] uppercase tracking-wider text-zinc-600"><tr>{headers.map((header, index) => <th key={header} className={clsx('px-2 py-2 font-bold', index > 0 && 'text-right')}>{header}</th>)}</tr></thead>
    <tbody>{rows.map((row, rowIndex) => <tr key={rowIndex} className="border-t border-white/[.05]">{row.map((cell, cellIndex) => <td key={cellIndex} className={clsx('px-2 py-2', cellIndex > 0 ? 'text-right tabular-nums text-zinc-300' : 'text-zinc-400')}>{cell}</td>)}</tr>)}</tbody></table>;
}

/** Panneau de graphique avec sa vue tableau : les valeurs restent lisibles sans survol ni couleur. */
function ChartPanel({ title, subtitle, legend, table, children, className }: { title: string; subtitle: string; legend?: ReactNode; table: ReactNode; children: ReactNode; className?: string }) {
  const [showTable, setShowTable] = useState(false);
  return <Panel className={clsx('p-5', className)}>
    <div className="mb-4 flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="font-semibold text-zinc-100">{title}</h2><p className="mt-1 text-xs text-zinc-600">{subtitle}</p></div>
      <button type="button" onClick={() => setShowTable((value) => !value)} aria-pressed={showTable} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/[.07] px-2.5 py-1.5 text-[11px] font-semibold text-zinc-500 transition hover:bg-white/[.05] hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blood-400">{showTable ? <><TrendingUp className="h-3.5 w-3.5" />Graphique</> : <><Table className="h-3.5 w-3.5" />Tableau</>}</button></div>
    {legend && !showTable && <div className="mb-3">{legend}</div>}
    {showTable ? <div className="max-h-[300px] overflow-auto">{table}</div> : children}
  </Panel>;
}

function EmptyChart({ children }: { children: ReactNode }) {
  return <div className="grid h-full place-items-center text-sm text-zinc-600">{children}</div>;
}

export function DashboardPage() {
  const [period, setPeriod] = useState('30');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const { can } = useAuth();
  const range = useMemo(() => {
    if (period === 'custom') return { from: customFrom, to: customTo };
    const to = new Date();
    return { from: format(addDays(to, -Number(period)), 'yyyy-MM-dd'), to: format(to, 'yyyy-MM-dd') };
  }, [period, customFrom, customTo]);
  const { data, loading, error, reload } = useApi<DashboardData>('/dashboard', range);
  const dashboard = data || EMPTY;
  const t = dashboard.totals || EMPTY.totals;
  const treasury = dashboard.treasury;
  const methods = dashboard.paymentsByMethod ?? [];
  const averageOrder = t.salesCount ? t.revenue / t.salesCount : 0;
  const marginRate = t.revenue ? (t.grossProfit / t.revenue) * 100 : 0;
  const receivedDirty = dashboard.receivedDirty ?? 0;
  const lastBalance = treasury?.timeline.at(-1);
  const maxQuantity = Math.max(1, ...dashboard.topItems.map((item) => item.quantity));

  return <div className="animate-enter">
    <PageHeader eyebrow="Centre de commandement" title="Tableau de bord" description="Ventes, argent propre et argent sale, blanchiment et opérations en cours." action={<div className="flex flex-wrap items-center gap-2"><Select aria-label="Période" value={period} onChange={(e) => setPeriod(e.target.value)} className="w-44"><option value="7">7 derniers jours</option><option value="30">30 derniers jours</option><option value="90">90 derniers jours</option><option value="365">12 derniers mois</option><option value="custom">Période personnalisée</option></Select>{period === 'custom' && <><input aria-label="Date de début" type="date" className="field w-auto" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} /><input aria-label="Date de fin" type="date" className="field w-auto" value={customTo} onChange={(e) => setCustomTo(e.target.value)} /></>}</div>} />
    {loading && !data ? <LoadingState /> : error && !data ? <Panel><ErrorState message={error} retry={reload} /></Panel> : <div className={clsx('transition-opacity', loading && 'opacity-60')} aria-busy={loading}>

      <SectionTitle>Activité de la période</SectionTitle>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Chiffre d’affaires" value={currency(t.revenue)} caption={`${number(t.salesCount)} vente${t.salesCount > 1 ? 's' : ''} · panier moyen ${currency(averageOrder)}`} icon={TrendingUp} />
        <StatCard label="Encaissements" value={currency(t.received)} caption={receivedDirty > 0 ? `dont ${currency(receivedDirty)} en argent sale` : 'Paiements réellement reçus'} icon={Banknote} tone="positive" />
        <StatCard label="Bénéfice brut" value={currency(t.grossProfit)} caption={t.revenue ? `Marge de ${percent(marginRate)} % · hors dépenses` : 'Estimation hors dépenses'} icon={CircleDollarSign} tone="positive" />
        <StatCard label="Dépenses" value={currency(t.expenses)} caption="Sorties de la période" icon={ReceiptText} tone="negative" />
      </div>

      {treasury && <>
        <SectionTitle>Trésorerie</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label={fundLabels.clean} marker={fundColors.clean} value={currency(treasury.cleanBalance)} caption="Utilisable directement" icon={WalletCards} />
          <StatCard label={fundLabels.dirty} marker={fundColors.dirty} value={currency(treasury.dirtyBalance)} caption={treasury.dirtyBalance > 0 && can('treasury.write') ? <Link to="/finances" className="font-semibold text-blood-400 hover:text-blood-300">À blanchir →</Link> : 'À blanchir avant usage'} icon={WashingMachine} tone={treasury.dirtyBalance > 0 ? 'warning' : 'neutral'} />
          <StatCard label="Blanchi sur la période" value={currency(treasury.launderedClean)} caption={treasury.launderingCount ? `${currency(treasury.launderedDirty)} engagés · commission ${currency(treasury.launderingFees)}` : 'Aucun blanchiment'} icon={WashingMachine} />
          <StatCard label="Apports sur la période" value={currency(treasury.depositsClean + treasury.depositsDirty)} caption={`Propre ${currency(treasury.depositsClean)} · Sale ${currency(treasury.depositsDirty)}`} icon={PiggyBank} />
        </div>
      </>}

      <SectionTitle>À suivre</SectionTitle>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Dettes clients" value={currency(t.outstandingDebt)} caption="Montant restant à recouvrer" icon={HandCoins} tone={t.outstandingDebt > 0 ? 'warning' : 'positive'} />
        <StatCard label="Ventes à traiter" value={number(t.pendingOrders)} caption="En attente, confirmées ou partiellement livrées" icon={Clock3} tone={t.pendingOrders ? 'warning' : 'neutral'} />
        <StatCard label="Alertes de stock" value={number(t.lowStockItems)} caption="Ruptures ou seuil critique" icon={PackageX} tone={t.lowStockItems ? 'negative' : 'positive'} />
        {treasury
          ? <StatCard label="Groupes acheteurs" value={number(t.groupsCount)} caption={`${number(t.contactsCount)} contacts enregistrés`} icon={UsersRound} />
          : <StatCard label="Solde de caisse" value={currency(t.cashBalance)} caption="Trésorerie disponible" icon={WalletCards} tone={t.cashBalance >= 0 ? 'positive' : 'negative'} />}
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,.75fr)]">
        <ChartPanel title="Activité commerciale" subtitle="Ventes et encaissements par jour" legend={<ChartLegend items={[{ label: 'Ventes', color: SALES }, { label: 'Encaissements', color: CONTEXT, shape: 'dashed' }]} />}
          table={<MiniTable headers={['Jour', 'Ventes', 'Encaissements', 'Bénéfice']} rows={dashboard.salesTrend.map((row) => [dayLabel(row.date), currency(row.sales), currency(row.received), currency(row.profit)])} />}>
          <div className="h-[280px]">{dashboard.salesTrend.length ? <ResponsiveContainer width="100%" height="100%"><AreaChart data={dashboard.salesTrend} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}><defs><linearGradient id="sales" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={SALES} stopOpacity={.18} /><stop offset="100%" stopColor={SALES} stopOpacity={0} /></linearGradient></defs><CartesianGrid stroke={GRID} vertical={false} /><XAxis dataKey="date" tickFormatter={dayLabel} stroke={AXIS} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} /><YAxis stroke={AXIS} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(value) => compact(value)} width={44} /><Tooltip contentStyle={tooltipStyle} cursor={{ stroke: 'rgba(255,255,255,.18)' }} labelFormatter={(value) => date(String(value))} formatter={(value: number, name: string) => [currency(value), name === 'sales' ? 'Ventes' : 'Encaissements']} /><Area type="monotone" dataKey="sales" stroke={SALES} strokeWidth={2} fill="url(#sales)" activeDot={{ r: 4, stroke: SURFACE, strokeWidth: 2 }} /><Area type="monotone" dataKey="received" stroke={CONTEXT} strokeWidth={2} fill="transparent" strokeDasharray="4 4" activeDot={{ r: 4, stroke: SURFACE, strokeWidth: 2 }} /></AreaChart></ResponsiveContainer> : <EmptyChart>Aucune activité sur cette période</EmptyChart>}</div>
        </ChartPanel>

        <ChartPanel title="Encaissements par moyen de paiement" subtitle="Sur la période, selon la caisse alimentée" legend={<ChartLegend items={[{ label: fundLabels.dirty, color: fundColors.dirty, shape: 'square' }, { label: fundLabels.clean, color: fundColors.clean, shape: 'square' }]} />}
          table={<MiniTable headers={['Moyen', 'Caisse', 'Montant']} rows={methods.map((row) => [row.name, fundLabels[row.fund], currency(row.amount)])} />}>
          <div style={{ height: Math.max(180, methods.length * 40 + 16) }}>{methods.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={methods} layout="vertical" margin={{ top: 0, right: 72, left: 0, bottom: 0 }}><XAxis type="number" hide /><YAxis type="category" dataKey="name" width={110} stroke={AXIS} tick={{ fontSize: 11, fill: '#a1a1aa' }} tickLine={false} axisLine={false} /><Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(255,255,255,.03)' }} formatter={(value: number) => [currency(value), 'Encaissé']} /><Bar dataKey="amount" barSize={16} radius={[0, 4, 4, 0]}>{methods.map((row) => <Cell key={row.name} fill={fundColors[row.fund]} />)}<LabelList dataKey="amount" position="right" formatter={(value: number) => currency(value)} style={{ fill: '#d4d4d8', fontSize: 11 }} /></Bar></BarChart></ResponsiveContainer> : <EmptyChart>Aucun encaissement sur cette période</EmptyChart>}</div>
        </ChartPanel>
      </div>

      {treasury && <ChartPanel className="mt-4" title="Évolution de la trésorerie" subtitle="Solde d’argent propre et d’argent sale en fin de journée"
        legend={<ChartLegend items={[{ label: fundLabels.clean, color: fundColors.clean, value: currency(lastBalance?.clean ?? treasury.cleanBalance) }, { label: fundLabels.dirty, color: fundColors.dirty, value: currency(lastBalance?.dirty ?? treasury.dirtyBalance) }]} />}
        table={<MiniTable headers={['Jour', fundLabels.clean, fundLabels.dirty]} rows={[...treasury.timeline].reverse().map((row) => [dayLabel(row.date), currency(row.clean), currency(row.dirty)])} />}>
        <div className="h-[260px]">{treasury.timeline.length > 1 ? <ResponsiveContainer width="100%" height="100%"><LineChart data={treasury.timeline} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}><CartesianGrid stroke={GRID} vertical={false} /><XAxis dataKey="date" tickFormatter={dayLabel} stroke={AXIS} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} /><YAxis stroke={AXIS} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(value) => compact(value)} width={44} /><Tooltip contentStyle={tooltipStyle} cursor={{ stroke: 'rgba(255,255,255,.18)' }} labelFormatter={(value) => date(String(value))} formatter={(value: number, name: string) => [currency(value), name === 'clean' ? fundLabels.clean : fundLabels.dirty]} /><Line type="stepAfter" dataKey="clean" stroke={fundColors.clean} strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: SURFACE, strokeWidth: 2 }} strokeLinejoin="round" strokeLinecap="round" /><Line type="stepAfter" dataKey="dirty" stroke={fundColors.dirty} strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: SURFACE, strokeWidth: 2 }} strokeLinejoin="round" strokeLinecap="round" /></LineChart></ResponsiveContainer> : <EmptyChart>Aucun mouvement d’argent sur cette période</EmptyChart>}</div>
      </ChartPanel>}

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <ChartPanel title="Groupes les plus actifs" subtitle="Montant vendu sur la période" table={<MiniTable headers={['Groupe', 'Ventes', 'Montant']} rows={dashboard.activeGroups.map((row) => [row.name, number(row.orders), currency(row.amount)])} />}>
          <div className="h-64">{dashboard.activeGroups.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={dashboard.activeGroups} layout="vertical" margin={{ left: 5, right: 72 }}><CartesianGrid stroke={GRID} horizontal={false} /><XAxis type="number" hide /><YAxis type="category" dataKey="name" width={105} stroke={AXIS} tick={{ fontSize: 10, fill: '#a1a1aa' }} tickLine={false} axisLine={false} /><Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(255,255,255,.03)' }} formatter={(value: number) => [currency(value), 'Vendu']} /><Bar dataKey="amount" fill="#ab1e25" radius={[0, 4, 4, 0]} barSize={14}><LabelList dataKey="amount" position="right" formatter={(value: number) => currency(value)} style={{ fill: '#d4d4d8', fontSize: 10 }} /></Bar></BarChart></ResponsiveContainer> : <EmptyChart>Pas encore de classement</EmptyChart>}</div>
        </ChartPanel>
        <Panel className="p-5"><div className="mb-5 flex items-center justify-between"><div><h2 className="font-semibold text-zinc-100">Articles les plus vendus</h2><p className="mt-1 text-xs text-zinc-600">Top 10 en quantité, avec le montant vendu</p></div><ShoppingBag className="h-5 w-5 text-zinc-600" /></div><div className="space-y-3">{dashboard.topItems.length ? dashboard.topItems.slice(0, 10).map((item, index) => <div key={item.name} className="flex items-center gap-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/[.04] text-[10px] font-bold text-zinc-600">{String(index + 1).padStart(2, '0')}</span><div className="min-w-0 flex-1"><div className="mb-1 flex justify-between gap-2 text-xs"><span className="truncate font-medium text-zinc-300">{item.name}</span><span className="shrink-0 text-zinc-500">{number(item.quantity)} unités · {currency(item.amount)}</span></div><div className="h-1 overflow-hidden rounded-full bg-white/[.05]"><div className="h-full rounded-full bg-gradient-to-r from-blood-700 to-blood-400" style={{ width: `${Math.max(5, (item.quantity / maxQuantity) * 100)}%` }} /></div></div></div>) : <div className="grid h-52 place-items-center text-sm text-zinc-600">Aucun article vendu</div>}</div></Panel>
      </div>

      <div className="mt-4 grid gap-4 2xl:grid-cols-[minmax(0,1.5fr)_minmax(360px,.7fr)]">
        <Panel className="overflow-hidden"><div className="flex items-center justify-between border-b border-white/[.07] px-5 py-4"><div><h2 className="font-semibold text-zinc-100">Dernières ventes</h2><p className="mt-1 text-xs text-zinc-600">Derniers mouvements commerciaux</p></div><Link to="/ventes" className="flex items-center gap-1 text-xs font-semibold text-blood-400 hover:text-blood-300">Tout voir <ArrowRight className="h-3.5 w-3.5" /></Link></div><DataTable<Order> rows={dashboard.recentOrders || []} rowKey={(o) => o.id} emptyTitle="Aucune vente" emptyDescription="Les ventes enregistrées apparaîtront ici." columns={[{ key: 'reference', label: 'Référence', render: (o) => <span className="font-mono text-xs font-semibold text-zinc-300">{o.reference}</span> }, { key: 'buyer', label: 'Acheteur', render: (o) => o.groupName || 'Indépendant' }, { key: 'date', label: 'Date', render: (o) => <span className="text-zinc-500">{date(o.orderDate)}</span> }, { key: 'total', label: 'Montant', className: 'text-right', render: (o) => <span className="font-semibold text-zinc-200">{currency(o.totalAmount)}</span> }, { key: 'status', label: 'Statut', render: (o) => <Badge>{o.status}</Badge> }]} /></Panel>
        <Panel className="overflow-hidden"><div className="flex items-center justify-between border-b border-white/[.07] px-5 py-4"><div><h2 className="font-semibold text-zinc-100">Stock critique</h2><p className="mt-1 text-xs text-zinc-600">À réapprovisionner</p></div><Boxes className="h-5 w-5 text-zinc-600" /></div><div className="divide-y divide-white/[.055]">{(dashboard.lowStock || []).length ? dashboard.lowStock.slice(0, 6).map((item: Item) => <div key={item.id} className="flex items-center gap-3 px-5 py-4"><div className="grid h-9 w-9 place-items-center rounded-xl bg-red-500/[.08] text-red-400"><PackageX className="h-4 w-4" /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-zinc-300">{item.name}</p><p className="mt-0.5 text-[11px] text-zinc-600">Seuil : {number(item.alertThreshold)} {item.unit}</p></div><div className="text-right"><p className="text-sm font-bold text-red-400">{number(item.stock)}</p><p className="text-[9px] uppercase text-zinc-700">en stock</p></div></div>) : <div className="grid min-h-52 place-items-center p-6 text-center"><div><Boxes className="mx-auto mb-2 h-6 w-6 text-emerald-500" /><p className="text-sm text-zinc-500">Aucune alerte de stock</p></div></div>}</div></Panel>
      </div>
    </div>}
  </div>;
}
