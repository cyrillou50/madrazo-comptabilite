import type { AuditData } from '../types';
import { currency, number } from './format';

export interface ActivityEntry {
  action: string;
  entityType?: string;
  entityId?: string | number;
  beforeData?: AuditData;
  afterData?: AuditData;
}

export type ActivityTone = 'success' | 'warning' | 'danger' | 'neutral' | 'info';

export interface ActivityDescription {
  /** Libellé court de l'action, ex. « Vente créée ». */
  label: string;
  /** Précisions lisibles : référence, nom, montant… */
  detail: string;
  /** Phrase à la troisième personne pour les notifications, ex. « a créé la vente MDR-… ». */
  sentence: string;
  /** Élément concerné, ex. « Vente MDR-… ». */
  target: string;
  to?: string;
  tone: ActivityTone;
}

type Data = Record<string, any>;
interface ActionText { label: string; sentence?: (after: Data, before: Data) => string; detail?: (after: Data, before: Data) => string }

const entityLabels: Record<string, string> = {
  user: 'Utilisateur', role: 'Rôle', group: 'Groupe', contact: 'Contact', item: 'Marchandise', order: 'Vente',
  payment: 'Paiement', stock_movement: 'Mouvement de stock', expense: 'Dépense', item_category: 'Catégorie de marchandises',
  expense_category: 'Catégorie de dépenses', group_type: 'Type de groupe', payment_method: 'Moyen de paiement',
  setting: 'Paramètres', settings: 'Paramètres', treasury_operation: 'Opération de trésorerie',
};

const entityLinks: Record<string, string> = {
  order: '/ventes', payment: '/paiements', stock_movement: '/stocks', expense: '/finances', group: '/groupes', contact: '/contacts',
  item: '/catalogue', item_category: '/catalogue', expense_category: '/finances', group_type: '/groupes', payment_method: '/paiements',
  user: '/utilisateurs', role: '/utilisateurs', settings: '/parametres', setting: '/parametres', treasury_operation: '/finances',
};

const quoted = (value: unknown) => (value ? `« ${value} »` : '');
const money = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? currency(value) : '');
const join = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' · ');
const signed = (value: unknown) => {
  const quantity = Number(value);
  return Number.isFinite(quantity) ? `${quantity > 0 ? '+' : ''}${number(quantity)}` : '';
};
const userName = (data: Data) => data.displayName || (data.username ? `@${data.username}` : '');
const cents = (value: unknown) => (typeof value === 'number' ? money(value / 100) : '');
const fundName = (fund: unknown) => (fund === 'dirty' ? 'argent sale' : 'argent propre');

const stockMovementLabels: Record<string, string> = { entry: 'Entrée de stock', return: 'Retour en stock', adjustment: 'Correction de stock' };
const stockMovementSentences: Record<string, string> = { entry: 'une entrée de stock', return: 'un retour en stock', adjustment: 'une correction de stock' };

function listActions(entity: string, singular: string, feminine: boolean): Record<string, ActionText> {
  const e = feminine ? 'e' : '';
  const article = feminine ? 'la' : 'le';
  return {
    [`${entity}.created`]: { label: `${singular} créé${e}`, sentence: (a) => `a créé ${article} ${singular.toLowerCase()} ${quoted(a.name)}`, detail: (a) => a.name ?? '' },
    [`${entity}.updated`]: {
      label: `${singular} modifié${e}`, sentence: (a) => `a modifié ${article} ${singular.toLowerCase()} ${quoted(a.name)}`,
      detail: (a, b) => (b.name && a.name && b.name !== a.name ? `${b.name} → ${a.name}` : a.name ?? ''),
    },
    [`${entity}.archived`]: { label: `${singular} archivé${e}`, sentence: (a) => `a archivé ${article} ${singular.toLowerCase()} ${quoted(a.name)}`, detail: (a) => a.name ?? '' },
    [`${entity}.restored`]: { label: `${singular} restauré${e}`, sentence: (a) => `a restauré ${article} ${singular.toLowerCase()} ${quoted(a.name)}`, detail: (a) => a.name ?? '' },
    [`${entity}.deleted`]: { label: `${singular} supprimé${e}`, sentence: (_a, b) => `a supprimé ${article} ${singular.toLowerCase()} ${quoted(b.name)}`, detail: (_a, b) => b.name ?? '' },
  };
}

const actions: Record<string, ActionText> = {
  'auth.login_failed': { label: 'Connexion refusée', sentence: () => 'a échoué à se connecter', detail: (a) => (a.username ? `Pseudo saisi : ${a.username}` : '') },
  'auth.login_succeeded': { label: 'Connexion', sentence: () => 's’est connecté(e)' },
  'auth.logout': { label: 'Déconnexion', sentence: () => 's’est déconnecté(e)' },

  'user.created': { label: 'Compte créé', sentence: (a) => `a créé le compte de ${userName(a)}`, detail: (a) => join(userName(a), a.username && `pseudo @${a.username}`, a.role && `rôle ${a.role}`) },
  'user.updated': {
    label: 'Compte modifié', sentence: (a) => `a modifié le compte de ${userName(a)}`,
    detail: (a, b) => join(b.username && a.username && b.username !== a.username && `pseudo @${b.username} → @${a.username}`, b.displayName && a.displayName && b.displayName !== a.displayName ? `nom ${b.displayName} → ${a.displayName}` : a.displayName),
  },
  'user.password_reset': { label: 'Mot de passe réinitialisé', sentence: (a) => `a réinitialisé le mot de passe de ${userName(a)}`, detail: (a) => userName(a) },
  'user.password_changed': { label: 'Mot de passe changé', sentence: () => 'a changé son mot de passe', detail: (a) => (a.username ? `@${a.username}` : '') },
  'user.permissions_updated': { label: 'Droits individuels modifiés', sentence: (a) => `a modifié les droits de ${userName(a)}`, detail: (a) => userName(a) },
  'user.role_updated': { label: 'Rôle attribué', sentence: (a) => `a attribué le rôle ${quoted(a.role)} à ${userName(a)}`, detail: (a, b) => join(userName(a), b.role && a.role ? `${b.role} → ${a.role}` : a.role) },
  'user.status_updated': {
    label: 'État du compte modifié', sentence: (a) => `a ${a.isActive ? 'réactivé' : 'désactivé'} le compte de ${userName(a)}`,
    detail: (a) => join(userName(a), a.isActive ? 'compte réactivé' : 'compte désactivé'),
  },

  'role.created': { label: 'Rôle créé', sentence: (a) => `a créé le rôle ${quoted(a.label)}`, detail: (a) => join(a.label, Array.isArray(a.permissionCodes) && `${a.permissionCodes.length} droit(s)`) },
  'role.updated': { label: 'Rôle modifié', sentence: (a) => `a modifié le rôle ${quoted(a.label)}`, detail: (a, b) => join(b.label && a.label && b.label !== a.label ? `${b.label} → ${a.label}` : a.label, Array.isArray(a.permissionCodes) && `${a.permissionCodes.length} droit(s)`) },
  'role.deleted': { label: 'Rôle supprimé', sentence: (_a, b) => `a supprimé le rôle ${quoted(b.label)}`, detail: (_a, b) => b.label ?? '' },

  ...listActions('item_category', 'Catégorie de marchandises', true),
  ...listActions('expense_category', 'Catégorie de dépenses', true),
  ...listActions('group_type', 'Type de groupe', false),
  ...listActions('payment_method', 'Moyen de paiement', false),

  'group.created': { label: 'Groupe créé', sentence: (a) => `a créé le groupe ${quoted(a.name)}`, detail: (a) => join(a.name, a.typeName) },
  'group.updated': { label: 'Groupe modifié', sentence: (a) => `a modifié le groupe ${quoted(a.name)}`, detail: (a, b) => join(b.name && a.name && b.name !== a.name ? `${b.name} → ${a.name}` : a.name, b.status && a.status && b.status !== a.status && `statut ${b.status} → ${a.status}`) },
  'group.archived': { label: 'Groupe archivé', sentence: (a) => `a archivé le groupe ${quoted(a.name)}`, detail: (a) => a.name ?? '' },
  'group_price.created': { label: 'Tarif de groupe ajouté', sentence: (a) => `a ajouté un tarif pour ${quoted(a.name)}`, detail: (a) => join(a.name, a.itemName, typeof a.priceCents === 'number' && money(a.priceCents / 100)) },

  'contact.created': { label: 'Contact créé', sentence: (a) => `a ajouté le contact ${a.name ?? ''}`.trim(), detail: (a) => a.name ?? '' },
  'contact.updated': { label: 'Contact modifié', sentence: (a) => `a modifié le contact ${a.name ?? ''}`.trim(), detail: (a) => a.name ?? '' },
  'contact.archived': { label: 'Contact archivé', sentence: (a) => `a archivé le contact ${a.name ?? ''}`.trim(), detail: (a) => a.name ?? '' },

  'item.created': { label: 'Marchandise ajoutée', sentence: (a) => `a ajouté la marchandise ${quoted(a.name)}`, detail: (a) => join(a.name, a.sku, money(a.defaultPrice)) },
  'item.updated': { label: 'Marchandise modifiée', sentence: (a) => `a modifié la marchandise ${quoted(a.name)}`, detail: (a, b) => join(a.name, b.defaultPrice !== undefined && a.defaultPrice !== undefined && b.defaultPrice !== a.defaultPrice && `prix ${money(b.defaultPrice)} → ${money(a.defaultPrice)}`) },
  'item.archived': { label: 'Marchandise archivée', sentence: (a) => `a archivé la marchandise ${quoted(a.name)}`, detail: (a) => join(a.name, a.sku) },

  'order.created': { label: 'Vente créée', sentence: (a) => `a créé la vente ${a.reference ?? ''}${a.groupName ? ` pour ${a.groupName}` : ''}${a.totalAmount !== undefined ? ` (${money(a.totalAmount)})` : ''}`, detail: (a) => join(a.reference, a.groupName || 'Acheteur indépendant', money(a.totalAmount)) },
  'order.status_updated': { label: 'Statut de vente modifié', sentence: (a) => `a passé la vente ${a.reference ?? ''} au statut ${quoted(a.status)}`, detail: (a, b) => join(a.reference, b.status && a.status ? `${b.status} → ${a.status}` : a.status) },
  'order.delivered': { label: 'Livraison enregistrée', sentence: (a) => `a livré la vente ${a.reference ?? ''}`.trim(), detail: (a) => join(a.reference, a.status) },
  'order.cancelled': { label: 'Vente annulée', sentence: (a) => `a annulé la vente ${a.reference ?? ''}`.trim(), detail: (a) => join(a.reference, a.reason && `motif : ${a.reason}`) },

  'payment.created': { label: 'Paiement encaissé', sentence: (a) => `a encaissé ${money(a.amount)}${a.reference ? ` sur ${a.reference}` : ''}`, detail: (a) => join(money(a.amount), a.reference, a.method) },
  'payment.reversed': { label: 'Paiement annulé', sentence: (a) => `a annulé un paiement${a.amount !== undefined ? ` de ${money(a.amount)}` : ''}${a.reference ? ` sur ${a.reference}` : ''}`, detail: (a) => join(money(a.amount), a.reference, a.reason && `motif : ${a.reason}`) },

  'stock.movement_created': {
    label: 'Mouvement de stock',
    sentence: (a) => `a enregistré ${stockMovementSentences[a.type] ?? 'un mouvement de stock'} : ${a.itemName ?? 'marchandise'} ${signed(a.quantityDelta ?? a.quantity)}`,
    detail: (a) => join(stockMovementLabels[a.type], a.itemName && `${a.itemName} ${signed(a.quantityDelta ?? a.quantity)}`, a.reason),
  },

  'expense.created': { label: 'Dépense enregistrée', sentence: (a) => `a enregistré la dépense ${quoted(a.label)}${a.amount !== undefined ? ` (${money(a.amount)})` : ''}`, detail: (a) => join(a.label, money(a.amount), a.category) },
  'expense.reversed': { label: 'Dépense annulée', sentence: (a) => `a annulé la dépense ${quoted(a.label)}`, detail: (a) => join(a.label, money(a.amount), a.reason && `motif : ${a.reason}`) },

  'treasury.deposit_created': { label: 'Argent ajouté', sentence: (a) => `a ajouté ${money(a.amount)} en ${fundName(a.fund)}`, detail: (a) => join(a.label, money(a.amount), fundName(a.fund)) },
  'treasury.laundering_created': { label: 'Argent blanchi', sentence: (a) => `a blanchi ${cents(a.dirtyAmountCents)} d’argent sale (${cents(a.cleanAmountCents)} d’argent propre obtenus)`, detail: (a) => join(`${cents(a.dirtyAmountCents)} sale → ${cents(a.cleanAmountCents)} propre`, typeof a.feeCents === 'number' && `commission ${cents(a.feeCents)}`) },
  'treasury.operation_reversed': { label: 'Opération de trésorerie annulée', sentence: (a) => (a.operationType === 'laundering' ? `a annulé un blanchiment de ${money(a.amount)}` : `a annulé l’apport ${quoted(a.label)}`), detail: (a) => join(a.label, money(a.amount), a.reason && `motif : ${a.reason}`) },

  'setting.updated': { label: 'Paramètre modifié', sentence: () => 'a modifié les paramètres' },
  'settings.updated': { label: 'Paramètres modifiés', sentence: () => 'a modifié les paramètres' },
};

function toneOf(action: string, after: Data): ActivityTone {
  if (action === 'user.status_updated') return after.isActive ? 'success' : 'danger';
  if (/failed|cancel|reversed|archived|deleted/.test(action)) return 'danger';
  if (/created|succeeded|delivered|restored/.test(action)) return 'success';
  if (/updated|movement|password/.test(action)) return 'info';
  return 'neutral';
}

function humanize(action: string): string {
  const [entity = '', verb = ''] = action.split('.');
  const subject = entityLabels[entity] ?? entity.replaceAll('_', ' ');
  return `${subject.charAt(0).toUpperCase()}${subject.slice(1)} : ${verb.replaceAll('_', ' ')}`.trim();
}

export function actionLabel(action: string): string {
  return actions[action]?.label ?? humanize(action);
}

/** Options de filtre du journal, triées par libellé. */
export const actionOptions = Object.entries(actions)
  .map(([value, text]) => ({ value, label: text.label }))
  .sort((first, second) => first.label.localeCompare(second.label, 'fr'));

// Champs affichés dans le détail d'une entrée du journal ; les identifiants techniques sont volontairement ignorés.
const fieldLabels: Array<[string, string, (value: any) => string]> = [
  ['reference', 'Référence', String], ['name', 'Nom', String], ['label', 'Libellé', String], ['displayName', 'Nom affiché', String],
  ['username', 'Pseudo', String], ['role', 'Rôle', String], ['typeName', 'Type', String], ['groupName', 'Groupe', String],
  ['itemName', 'Marchandise', String], ['sku', 'Référence interne', String], ['category', 'Catégorie', String], ['method', 'Moyen de paiement', String],
  ['status', 'Statut', String], ['amount', 'Montant', money], ['totalAmount', 'Total', money], ['defaultPrice', 'Prix de vente', money],
  ['quantityDelta', 'Quantité', signed], ['type', 'Type de mouvement', (value) => stockMovementLabels[value] ?? String(value)],
  ['fund', 'Caisse', (value) => (value === 'dirty' ? 'Argent sale' : 'Argent propre')], ['dirtyAmountCents', 'Argent sale engagé', cents],
  ['cleanAmountCents', 'Argent propre obtenu', cents], ['feeCents', 'Commission', cents],
  ['reason', 'Motif', String], ['description', 'Description', String], ['isActive', 'Actif', (value) => (value ? 'Oui' : 'Non')],
  ['isDirty', 'Argent sale', (value) => (value ? 'Oui' : 'Non')], ['launderingFeePercent', 'Commission de blanchiment (%)', String],
  ['organizationName', 'Nom affiché', String], ['currency', 'Devise', (value) => (value === 'EUR' ? '€' : '$')],
  ['stockReservationEnabled', 'Réservation automatique', (value) => (value ? 'Oui' : 'Non')],
  ['sessionDurationMinutes', 'Durée de session (minutes)', String], ['debtWarningDays', 'Alerte dette après (jours)', String],
  ['defaultPageSize', 'Lignes par page', String],
  ['permissionCodes', 'Nombre de droits', (value) => (Array.isArray(value) ? String(value.length) : '')],
  ['overrides', 'Exceptions individuelles', (value) => (Array.isArray(value) ? String(value.length) : '')],
];

export function describeFields(data: AuditData | undefined): Array<{ label: string; value: string }> {
  if (!data) return [];
  return fieldLabels
    .filter(([key]) => data[key] !== undefined && data[key] !== null && data[key] !== '')
    .map(([key, label, format]) => ({ label, value: format(data[key]) }))
    .filter((field) => field.value !== '');
}

export function describeActivity(entry: ActivityEntry): ActivityDescription {
  const after: Data = entry.afterData ?? {};
  const before: Data = entry.beforeData ?? {};
  const text = actions[entry.action];
  const entityType = entry.entityType ?? entry.action.split('.')[0] ?? '';
  const entityLabel = entityLabels[entityType] ?? entityType;
  const name = after.reference ?? after.name ?? after.label ?? after.displayName ?? before.reference ?? before.name ?? before.label ?? before.displayName;
  const label = text?.label ?? humanize(entry.action);
  return {
    label,
    detail: text?.detail?.(after, before) ?? '',
    sentence: text?.sentence?.(after, before) ?? `a effectué : ${label.toLowerCase()}`,
    target: entityLabel ? `${entityLabel} ${name ?? (entry.entityId ? `n° ${entry.entityId}` : '')}`.trim() : '—',
    to: entityLinks[entityType],
    tone: toneOf(entry.action, after),
  };
}
