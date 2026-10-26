import { useEffect, useState } from 'react';
import { Database, ListChecks, Save, Settings2, ShieldCheck } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { useApi } from '../hooks/useApi';
import { Button, ErrorState, Input, LoadingState, PageHeader, Panel, Select } from '../components/ui';
import { CategoryManager, type ManagedListKind } from '../components/CategoryManager';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';

interface SettingsData { organizationName: string; currency: string; stockReservationEnabled: boolean; sessionDurationMinutes: number; debtWarningDays: number; defaultPageSize: number }
const defaults: SettingsData = { organizationName: 'MADRAZO', currency: 'USD', stockReservationEnabled: true, sessionDurationMinutes: 480, debtWarningDays: 30, defaultPageSize: 25 };

const managedLists: Array<{ kind: ManagedListKind; label: string; description: string; permission: string }> = [
  { kind: 'item-categories', label: 'Catégories de marchandises', description: 'Classement du catalogue', permission: 'catalog.write' },
  { kind: 'expense-categories', label: 'Catégories de dépenses', description: 'Classement des sorties d’argent', permission: 'expenses.write' },
  { kind: 'group-types', label: 'Types de groupes', description: 'Organisation, gang, MC…', permission: 'groups.write' },
  { kind: 'payment-methods', label: 'Moyens de paiement', description: 'Espèces, virement, argent sale…', permission: 'settings.write' },
];

export function SettingsPage() {
  const query = useApi<Partial<SettingsData>>('/settings'); const [values, setValues] = useState(defaults); const [saving, setSaving] = useState(false); const [openList, setOpenList] = useState<ManagedListKind | null>(null);
  const { notify } = useToast(); const { can, refresh } = useAuth();
  const canWrite = can('settings.write');
  const lists = managedLists.filter((list) => can(list.permission));
  useEffect(() => { if (query.data) setValues((current) => ({ ...current, ...query.data })); }, [query.data]);
  async function save() {
    setSaving(true);
    try { await api.put('/settings', values); notify('Paramètres enregistrés.'); query.reload(); await refresh(); }
    catch (reason) { notify(reason instanceof ApiError ? reason.message : 'Enregistrement impossible.', 'error'); }
    finally { setSaving(false); }
  }
  return <div className="animate-enter"><PageHeader eyebrow="Configuration" title="Paramètres généraux" description="Réglages de l’organisation, appliqués à tous les utilisateurs." action={canWrite ? <Button onClick={() => void save()} disabled={saving}><Save className="h-4 w-4" />{saving ? 'Enregistrement…' : 'Enregistrer'}</Button> : undefined} />
    {query.loading ? <LoadingState /> : query.error ? <Panel><ErrorState message={query.error} retry={query.reload} /></Panel> : <div className="max-w-4xl space-y-4">
      <Panel className="p-5"><div className="mb-5 flex items-center gap-3"><span className="rounded-xl bg-blood-500/10 p-2.5 text-blood-400"><Settings2 className="h-5 w-5" /></span><div><h2 className="font-semibold text-zinc-100">Organisation</h2><p className="text-xs text-zinc-600">Nom et affichage des montants</p></div></div><fieldset disabled={!canWrite} className="grid gap-4 sm:grid-cols-2">
        <Input label="Nom affiché" value={values.organizationName} onChange={(e) => setValues({ ...values, organizationName: e.target.value })} hint="Affiché dans le menu et l’onglet du navigateur." />
        <Select label="Devise" value={values.currency} onChange={(e) => setValues({ ...values, currency: e.target.value })}><option value="USD">$</option><option value="EUR">€</option></Select>
        <Input label="Alerte dette après (jours)" type="number" min="1" value={values.debtWarningDays} onChange={(e) => setValues({ ...values, debtWarningDays: Number(e.target.value) })} hint="Délai avant qu’une dette apparaisse dans les notifications." />
        <Input label="Lignes par page" type="number" min="10" max="100" value={values.defaultPageSize} onChange={(e) => setValues({ ...values, defaultPageSize: Number(e.target.value) })} />
      </fieldset></Panel>
      {lists.length > 0 && <Panel className="p-5"><div className="mb-5 flex items-center gap-3"><span className="rounded-xl bg-amber-500/10 p-2.5 text-amber-400"><ListChecks className="h-5 w-5" /></span><div><h2 className="font-semibold text-zinc-100">Listes personnalisables</h2><p className="text-xs text-zinc-600">Vous choisissez librement leur contenu</p></div></div><div className="grid gap-2 sm:grid-cols-2">{lists.map((list) => <button key={list.kind} type="button" onClick={() => setOpenList(list.kind)} className="rounded-xl border border-white/[.07] bg-white/[.02] p-4 text-left transition hover:border-white/[.12] hover:bg-white/[.05]"><span className="block text-sm font-semibold text-zinc-200">{list.label}</span><span className="mt-1 block text-xs text-zinc-600">{list.description}</span></button>)}</div></Panel>}
      <Panel className="p-5"><div className="mb-5 flex items-center gap-3"><span className="rounded-xl bg-sky-500/10 p-2.5 text-sky-400"><Database className="h-5 w-5" /></span><div><h2 className="font-semibold text-zinc-100">Stocks & commandes</h2><p className="text-xs text-zinc-600">Règles opérationnelles générales</p></div></div><label className="flex items-center justify-between gap-4 rounded-xl border border-white/[.07] bg-white/[.02] p-4"><div><p className="text-sm font-medium text-zinc-300">Réservation automatique</p><p className="mt-1 text-xs text-zinc-600">Réserver les quantités dès l’enregistrement d’une vente.</p></div><input type="checkbox" disabled={!canWrite} checked={values.stockReservationEnabled} onChange={(e) => setValues({ ...values, stockReservationEnabled: e.target.checked })} className="h-5 w-5 accent-blood-600" /></label></Panel>
      <Panel className="p-5"><div className="mb-5 flex items-center gap-3"><span className="rounded-xl bg-emerald-500/10 p-2.5 text-emerald-400"><ShieldCheck className="h-5 w-5" /></span><div><h2 className="font-semibold text-zinc-100">Sécurité des sessions</h2><p className="text-xs text-zinc-600">Durée d’activité autorisée</p></div></div><Input label="Expiration après (minutes)" type="number" min="15" max="1440" disabled={!canWrite} value={values.sessionDurationMinutes} onChange={(e) => setValues({ ...values, sessionDurationMinutes: Number(e.target.value) })} hint="S’applique aux prochaines connexions." /></Panel>
    </div>}
    {openList && <CategoryManager open onClose={() => setOpenList(null)} kind={openList} />}
  </div>;
}
