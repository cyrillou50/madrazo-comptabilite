import { useMemo, useState } from 'react';
import { addDays, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import {
  ArrowDownRight, ArrowRight, ArrowUpRight, Banknote, Boxes, CircleDollarSign,
  Clock3, HandCoins, PackageX, ReceiptText, ShoppingBag, TrendingUp, UsersRound, WalletCards,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { currency, date, number } from '../lib/format';
import type { DashboardData, Item, Order } from '../types';
import { Badge, ErrorState, LoadingState, PageHeader, Panel, Select } from '../components/ui';
import { DataTable } from '../components/DataTable';

const EMPTY: DashboardData = {
  totals: { received: 0, revenue: 0, grossProfit: 0, expenses: 0, cashBalance: 0, outstandingDebt: 0, salesCount: 0, groupsCount: 0, contactsCount: 0, pendingOrders: 0, lowStockItems: 0 },
  salesTrend: [], salesByItem: [], activeGroups: [], topItems: [], recentOrders: [], lowStock: [],
};

function StatCard({ label, value, caption, icon: Icon, tone = 'neutral' }: { label: string; value: string; caption: string; icon: any; tone?: 'positive' | 'negative' | 'warning' | 'neutral' }) {
  return <Panel className="group relative overflow-hidden p-5 transition hover:-translate-y-0.5 hover:border-white/[.12]">
    <span className={`absolute -right-5 -top-5 h-24 w-24 rounded-full blur-2xl ${tone === 'positive' ? 'bg-emerald-500/10' : tone === 'negative' ? 'bg-red-500/10' : tone === 'warning' ? 'bg-amber-500/10' : 'bg-blood-500/[.07]'}`} />
    <div className="relative flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-zinc-600">{label}</p><p className="mt-2 text-xl font-bold tracking-tight text-zinc-100 sm:text-2xl">{value}</p><p className={`mt-2 flex items-center gap-1 text-[11px] ${tone === 'positive' ? 'text-emerald-400' : tone === 'negative' ? 'text-red-400' : tone === 'warning' ? 'text-amber-400' : 'text-zinc-600'}`}>{tone === 'positive' ? <ArrowUpRight className="h-3.5 w-3.5" /> : tone === 'negative' ? <ArrowDownRight className="h-3.5 w-3.5" /> : null}{caption}</p></div><span className="rounded-xl border border-white/[.06] bg-white/[.035] p-2.5 text-zinc-500 transition group-hover:text-blood-400"><Icon className="h-5 w-5" /></span></div>
  </Panel>;
}

const tooltipStyle = { background: '#121518', border: '1px solid rgba(255,255,255,.09)', borderRadius: 12, color: '#e4e4e7', fontSize: 12 };
const COLORS = ['#c52a32', '#8d151b', '#e14a51', '#6f1419', '#a1a1aa', '#52525b'];

export function DashboardPage() {
  const [period, setPeriod] = useState('30');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const range = useMemo(() => {
    if (period === 'custom') return { from: customFrom, to: customTo };
    const to = new Date();
    return { from: format(addDays(to, -Number(period)), 'yyyy-MM-dd'), to: format(to, 'yyyy-MM-dd') };
  }, [period, customFrom, customTo]);
  const { data, loading, error, reload } = useApi<DashboardData>('/dashboard', range);
  const dashboard = data || EMPTY;
  const t = dashboard.totals || EMPTY.totals;

  return <div className="animate-enter">
    <PageHeader eyebrow="Centre de commandement" title="Tableau de bord" description="Une lecture instantanée des ventes, de la trésorerie et des opérations en cours." action={<div className="flex flex-wrap items-center gap-2"><Select aria-label="Période" value={period} onChange={(e) => setPeriod(e.target.value)} className="w-44"><option value="7">7 derniers jours</option><option value="30">30 derniers jours</option><option value="90">90 derniers jours</option><option value="365">12 derniers mois</option><option value="custom">Période personnalisée</option></Select>{period === 'custom' && <><input aria-label="Date de début" type="date" className="field w-auto" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} /><input aria-label="Date de fin" type="date" className="field w-auto" value={customTo} onChange={(e) => setCustomTo(e.target.value)} /></>}</div>} />
    {loading ? <LoadingState /> : error ? <Panel><ErrorState message={error} retry={reload} /></Panel> : <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Encaissements" value={currency(t.received)} caption="Paiements réellement reçus" icon={Banknote} tone="positive" />
        <StatCard label="Chiffre d’affaires" value={currency(t.revenue)} caption={`${number(t.salesCount)} vente${t.salesCount > 1 ? 's' : ''}`} icon={TrendingUp} />
        <StatCard label="Bénéfice brut" value={currency(t.grossProfit)} caption="Estimation hors dépenses" icon={CircleDollarSign} tone="positive" />
        <StatCard label="Dépenses" value={currency(t.expenses)} caption="Décaissements de la période" icon={ReceiptText} tone="negative" />
        <StatCard label="Solde de caisse" value={currency(t.cashBalance)} caption="Trésorerie disponible" icon={WalletCards} tone={t.cashBalance >= 0 ? 'positive' : 'negative'} />
        <StatCard label="Dettes clients" value={currency(t.outstandingDebt)} caption="Montant restant à recouvrer" icon={HandCoins} tone={t.outstandingDebt > 0 ? 'warning' : 'positive'} />
        <StatCard label="Commandes en attente" value={number(t.pendingOrders)} caption={`${number(t.groupsCount)} groupes · ${number(t.contactsCount)} contacts`} icon={Clock3} tone={t.pendingOrders ? 'warning' : 'neutral'} />
        <StatCard label="Alertes de stock" value={number(t.lowStockItems)} caption="Ruptures ou seuil critique" icon={PackageX} tone={t.lowStockItems ? 'negative' : 'positive'} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,.75fr)]">
        <Panel className="p-5"><div className="mb-5 flex items-center justify-between"><div><h2 className="font-semibold text-zinc-100">Activité commerciale</h2><p className="mt-1 text-xs text-zinc-600">Ventes, encaissements et marge par période</p></div><TrendingUp className="h-5 w-5 text-blood-400" /></div><div className="h-[300px]">{dashboard.salesTrend.length ? <ResponsiveContainer width="100%" height="100%"><AreaChart data={dashboard.salesTrend}><defs><linearGradient id="sales" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#c52a32" stopOpacity={.32} /><stop offset="100%" stopColor="#c52a32" stopOpacity={0} /></linearGradient></defs><CartesianGrid stroke="rgba(255,255,255,.045)" vertical={false} /><XAxis dataKey="date" tickFormatter={(v) => format(new Date(v), 'dd MMM', { locale: fr })} stroke="#52525b" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} /><YAxis stroke="#52525b" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${Math.round(v / 1000)}k`} /><Tooltip contentStyle={tooltipStyle} labelFormatter={(v) => date(String(v))} formatter={(value: number, name: string) => [currency(value), name === 'sales' ? 'Ventes' : name === 'received' ? 'Encaissements' : 'Bénéfice']} /><Area type="monotone" dataKey="sales" stroke="#c52a32" strokeWidth={2} fill="url(#sales)" /><Area type="monotone" dataKey="received" stroke="#a1a1aa" strokeWidth={1.5} fill="transparent" strokeDasharray="4 4" /></AreaChart></ResponsiveContainer> : <div className="grid h-full place-items-center text-sm text-zinc-600">Aucune activité sur cette période</div>}</div></Panel>
        <Panel className="p-5"><div className="mb-5"><h2 className="font-semibold text-zinc-100">Répartition des ventes</h2><p className="mt-1 text-xs text-zinc-600">Par marchandise</p></div><div className="h-[220px]">{dashboard.salesByItem.length ? <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={dashboard.salesByItem} dataKey="value" nameKey="name" innerRadius={58} outerRadius={84} paddingAngle={3}>{dashboard.salesByItem.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip contentStyle={tooltipStyle} formatter={(v: number) => currency(v)} /></PieChart></ResponsiveContainer> : <div className="grid h-full place-items-center text-sm text-zinc-600">Aucune vente enregistrée</div>}</div><div className="mt-1 grid grid-cols-2 gap-2">{dashboard.salesByItem.slice(0, 6).map((item, i) => <div key={item.name} className="flex min-w-0 items-center gap-2 text-[11px] text-zinc-500"><span className="h-2 w-2 shrink-0 rounded-full" style={{ background: COLORS[i % COLORS.length] }} /><span className="truncate">{item.name}</span></div>)}</div></Panel>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Panel className="p-5"><div className="mb-5 flex items-center justify-between"><div><h2 className="font-semibold text-zinc-100">Groupes les plus actifs</h2><p className="mt-1 text-xs text-zinc-600">Volume facturé sur la période</p></div><UsersRound className="h-5 w-5 text-zinc-600" /></div><div className="h-64">{dashboard.activeGroups.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={dashboard.activeGroups} layout="vertical" margin={{ left: 5 }}><CartesianGrid stroke="rgba(255,255,255,.04)" horizontal={false} /><XAxis type="number" hide /><YAxis type="category" dataKey="name" width={105} stroke="#71717a" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} /><Tooltip contentStyle={tooltipStyle} formatter={(v: number) => currency(v)} /><Bar dataKey="amount" fill="#ab1e25" radius={[0, 5, 5, 0]} barSize={14} /></BarChart></ResponsiveContainer> : <div className="grid h-full place-items-center text-sm text-zinc-600">Pas encore de classement</div>}</div></Panel>
        <Panel className="p-5"><div className="mb-5 flex items-center justify-between"><div><h2 className="font-semibold text-zinc-100">Articles les plus vendus</h2><p className="mt-1 text-xs text-zinc-600">Top 10 en quantité</p></div><ShoppingBag className="h-5 w-5 text-zinc-600" /></div><div className="space-y-3">{dashboard.topItems.length ? dashboard.topItems.slice(0, 10).map((item, index) => <div key={item.name} className="flex items-center gap-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/[.04] text-[10px] font-bold text-zinc-600">{String(index + 1).padStart(2, '0')}</span><div className="min-w-0 flex-1"><div className="mb-1 flex justify-between gap-2 text-xs"><span className="truncate font-medium text-zinc-300">{item.name}</span><span className="text-zinc-500">{number(item.quantity)} unités</span></div><div className="h-1 overflow-hidden rounded-full bg-white/[.05]"><div className="h-full rounded-full bg-gradient-to-r from-blood-700 to-blood-400" style={{ width: `${Math.max(5, (item.quantity / Math.max(...dashboard.topItems.map((x) => x.quantity))) * 100)}%` }} /></div></div></div>) : <div className="grid h-52 place-items-center text-sm text-zinc-600">Aucun article vendu</div>}</div></Panel>
      </div>

      <div className="mt-4 grid gap-4 2xl:grid-cols-[minmax(0,1.5fr)_minmax(360px,.7fr)]">
        <Panel className="overflow-hidden"><div className="flex items-center justify-between border-b border-white/[.07] px-5 py-4"><div><h2 className="font-semibold text-zinc-100">Dernières commandes</h2><p className="mt-1 text-xs text-zinc-600">Derniers mouvements commerciaux</p></div><Link to="/ventes" className="flex items-center gap-1 text-xs font-semibold text-blood-400 hover:text-blood-300">Tout voir <ArrowRight className="h-3.5 w-3.5" /></Link></div><DataTable<Order> rows={dashboard.recentOrders || []} rowKey={(o) => o.id} columns={[{ key: 'reference', label: 'Référence', render: (o) => <span className="font-mono text-xs font-semibold text-zinc-300">{o.reference}</span> }, { key: 'buyer', label: 'Acheteur', render: (o) => o.groupName || 'Indépendant' }, { key: 'date', label: 'Date', render: (o) => <span className="text-zinc-500">{date(o.orderDate)}</span> }, { key: 'total', label: 'Montant', className: 'text-right', render: (o) => <span className="font-semibold text-zinc-200">{currency(o.totalAmount)}</span> }, { key: 'status', label: 'Statut', render: (o) => <Badge>{o.status}</Badge> }]} /></Panel>
        <Panel className="overflow-hidden"><div className="flex items-center justify-between border-b border-white/[.07] px-5 py-4"><div><h2 className="font-semibold text-zinc-100">Stock critique</h2><p className="mt-1 text-xs text-zinc-600">À réapprovisionner</p></div><Boxes className="h-5 w-5 text-zinc-600" /></div><div className="divide-y divide-white/[.055]">{(dashboard.lowStock || []).length ? dashboard.lowStock.slice(0, 6).map((item: Item) => <div key={item.id} className="flex items-center gap-3 px-5 py-4"><div className="grid h-9 w-9 place-items-center rounded-xl bg-red-500/[.08] text-red-400"><PackageX className="h-4 w-4" /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-zinc-300">{item.name}</p><p className="mt-0.5 text-[11px] text-zinc-600">Seuil : {number(item.alertThreshold)} {item.unit}</p></div><div className="text-right"><p className="text-sm font-bold text-red-400">{number(item.stock)}</p><p className="text-[9px] uppercase text-zinc-700">en stock</p></div></div>) : <div className="grid min-h-52 place-items-center p-6 text-center"><div><Boxes className="mx-auto mb-2 h-6 w-6 text-emerald-500" /><p className="text-sm text-zinc-500">Aucune alerte de stock</p></div></div>}</div></Panel>
      </div>
    </>}
  </div>;
}
