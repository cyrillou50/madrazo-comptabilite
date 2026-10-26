const configuredApiUrl = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
const API_URL = configuredApiUrl.endsWith('/api') ? configuredApiUrl : `${configuredApiUrl}/api`;
export const apiBaseUrl = API_URL;

const statusToFrench: Record<string, string> = {
  draft: 'Brouillon', pending: 'En attente', confirmed: 'Confirmée', partially_delivered: 'Partiellement livrée', delivered: 'Livrée', cancelled: 'Annulée',
  unpaid: 'Non payé', partial: 'Partiellement payé', partially_paid: 'Partiellement payé', paid: 'Payé', refunded: 'Remboursé',
  active: 'Actif', actif: 'Actif', regular: 'Acheteur régulier', regulier: 'Acheteur régulier',
  occasional: 'Acheteur occasionnel', occasionnel: 'Acheteur occasionnel', vip: 'VIP',
  watchlist: 'Sous surveillance', surveillance: 'Sous surveillance', blacklisted: 'Black-listé',
  blackliste: 'Black-listé', inactive: 'Inactif', inactif: 'Inactif', archived: 'Archivé',
};
const statusToApi: Record<string, string> = {
  brouillon: 'draft',
  'en attente': 'pending',
  confirmée: 'confirmed',
  'partiellement livrée': 'partially_delivered',
  livrée: 'delivered',
  annulée: 'cancelled',
  'non payé': 'unpaid',
  'partiellement payé': 'partial',
  payé: 'paid',
  actif: 'actif',
  'acheteur régulier': 'regulier',
  'acheteur occasionnel': 'occasionnel',
  vip: 'vip',
  'sous surveillance': 'surveillance',
  'black-listé': 'blackliste',
  inactif: 'inactif',
};

const roleToFrench: Record<string, string> = {
  patron: 'Patron',
  bras_droit: 'Bras droit',
  vendeur: 'Vendeur',
  lecture: 'Lecture seule',
};

function numeric(value: unknown): number | undefined {
  if (typeof value !== 'number' && typeof value !== 'string' && typeof value !== 'bigint') return undefined;
  const converted = Number(value);
  return Number.isFinite(converted) ? converted : undefined;
}

function normalizeResponse(value: any): any {
  if (Array.isArray(value)) return value.map(normalizeResponse);
  if (!value || typeof value !== 'object') return value;
  const result: Record<string, any> = {};
  for (const [key, item] of Object.entries(value)) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
    result[camelKey] = normalizeResponse(item);
  }
  const centsAliases: Record<string, string> = {
    unitCostCents: 'unitCost', defaultPriceCents: 'defaultPrice', minimumPriceCents: 'minimumPrice',
    unitPriceCents: 'unitPrice', totalCents: 'totalAmount', lineTotalCents: 'total', costCents: 'totalCost',
    marginCents: 'estimatedMargin', paidCents: 'paidAmount', dueCents: 'remainingAmount', amountCents: 'amount',
    totalPurchasesCents: 'totalPurchases', debtCents: 'debt',
  };
  for (const [source, target] of Object.entries(centsAliases)) {
    const amount = numeric(result[source]);
    if (amount !== undefined && result[target] === undefined) result[target] = amount / 100;
  }
  if (result.sku !== undefined && result.reference === undefined) result.reference = result.sku;
  if (result.email !== undefined && result.username === undefined) result.username = result.email;
  if (result.stockQuantity !== undefined && result.physicalStock === undefined) result.physicalStock = numeric(result.stockQuantity) ?? 0;
  if (result.reservedQuantity !== undefined && result.reservedStock === undefined) result.reservedStock = numeric(result.reservedQuantity) ?? 0;
  if (result.availableQuantity !== undefined) {
    result.availableQuantity = numeric(result.availableQuantity) ?? 0;
    if (result.stock === undefined) result.stock = result.availableQuantity;
  }
  if (result.stock === undefined && result.stockQuantity !== undefined) result.stock = numeric(result.stockQuantity) ?? 0;
  for (const key of ['quantity', 'quantityDelta', 'deliveredQuantity', 'alertThreshold']) {
    if (result[key] !== undefined) result[key] = numeric(result[key]) ?? 0;
  }
  if (result.quantityDelta !== undefined && result.quantity === undefined) result.quantity = result.quantityDelta;
  if (result.isActive !== undefined) {
    const enabled = Boolean(result.isActive);
    if (result.active === undefined) result.active = enabled;
    if (result.enabled === undefined) result.enabled = enabled;
  }
  if (result.roleGranted !== undefined) result.roleGranted = Boolean(result.roleGranted);
  if (result.effective !== undefined) result.effective = Boolean(result.effective);
  if (result.orderedAt !== undefined && result.orderDate === undefined) result.orderDate = result.orderedAt;
  if (result.managerName !== undefined && result.manager === undefined) result.manager = result.managerName;
  if (result.internalNotes !== undefined && result.notes === undefined) result.notes = result.internalNotes;
  if (result.roleInGroup !== undefined && result.role === undefined) result.role = result.roleInGroup;
  if (result.reversedAt !== undefined && result.cancelledAt === undefined) result.cancelledAt = result.reversedAt;
  if (result.paidAt !== undefined && result.paymentDate === undefined) result.paymentDate = result.paidAt;
  if (result.occurredAt !== undefined && result.createdAt === undefined) result.createdAt = result.occurredAt;
  if (result.actorName !== undefined && result.userName === undefined) result.userName = result.actorName;
  if (result.createdBy !== undefined && result.userName === undefined) result.userName = result.createdBy;
  if (result.afterData !== undefined && result.details === undefined) result.details = result.afterData;
  if (result.pages !== undefined && result.totalPages === undefined) result.totalPages = numeric(result.pages) ?? 0;
  if (result.limit !== undefined && result.pageSize === undefined) result.pageSize = numeric(result.limit) ?? 0;
  if (typeof result.status === 'string') result.status = statusToFrench[result.status.toLowerCase()] || result.status;
  if (typeof result.paymentStatus === 'string') result.paymentStatus = statusToFrench[result.paymentStatus.toLowerCase()] || result.paymentStatus;
  if (typeof result.role === 'string') result.role = roleToFrench[result.role.toLowerCase()] || result.role;
  if (typeof result.method === 'string') result.method = ({ cash: 'Espèces', bank: 'Virement', dirty_money: 'Argent sale', other: 'Autre' } as Record<string, string>)[result.method] || result.method;
  return result;
}

export function apiStatus(value: string): string {
  return statusToApi[value.toLowerCase()] || value;
}

function normalizeRequest(value: any): any {
  if (Array.isArray(value)) return value.map(normalizeRequest);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [
    key,
    (key === 'status' || key === 'paymentStatus') && typeof item === 'string' ? apiStatus(item) : normalizeRequest(item),
  ]));
}

export class ApiError extends Error {
  readonly status: number;
  readonly details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

let csrfToken: string | null = null;

async function readJson(response: Response): Promise<any> {
  const text = await response.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return { message: text }; }
}

async function ensureCsrf(): Promise<string> {
  if (csrfToken) return csrfToken;
  const response = await fetch(`${API_URL}/auth/csrf`, {
    credentials: 'include', headers: { Accept: 'application/json' },
  });
  const body = await readJson(response);
  if (!response.ok) throw new ApiError(body?.message || 'Impossible d’initialiser la session sécurisée.', response.status, body);
  csrfToken = body?.csrfToken ?? body?.data?.csrfToken;
  if (!csrfToken) throw new ApiError('Jeton de sécurité absent de la réponse.', 500);
  return csrfToken;
}

type QueryValue = string | number | boolean | null | undefined;
type Options = Omit<RequestInit, 'body'> & { body?: unknown; query?: Record<string, QueryValue> };

async function request<T>(path: string, options: Options = {}, retry = true): Promise<T> {
  const method = (options.method || 'GET').toUpperCase();
  const query = new URLSearchParams();
  Object.entries(options.query || {}).forEach(([key, value]) => {
    const apiKey = key === 'pageSize' ? 'limit' : key;
    if (value !== undefined && value !== null && value !== '') query.set(apiKey, typeof value === 'string' ? apiStatus(value) : String(value));
  });
  const url = `${API_URL}${path.startsWith('/') ? path : `/${path}`}${query.size ? `?${query}` : ''}`;
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');
  if (options.body !== undefined) headers.set('Content-Type', 'application/json');
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) headers.set('X-CSRF-Token', await ensureCsrf());

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(normalizeRequest(options.body)),
      credentials: 'include',
    });
  } catch (cause) {
    throw new ApiError('Le serveur Madrazo est injoignable. Vérifiez votre connexion.', 0, cause);
  }

  const body = await readJson(response);
  if (!response.ok) {
    const apiError = body?.error && typeof body.error === 'object' ? body.error : body;
    if (response.status === 403 && retry && apiError?.code === 'CSRF_INVALID') {
      csrfToken = null;
      return request<T>(path, options, false);
    }
    if (response.status === 401) window.dispatchEvent(new CustomEvent('madrazo:unauthorized'));
    const validation = apiError?.details?.fieldErrors
      ? Object.values(apiError.details.fieldErrors).flat().find((entry) => typeof entry === 'string')
      : undefined;
    throw new ApiError(String(validation || apiError?.message || 'Une erreur est survenue.'), response.status, body);
  }
  const returnedCsrf = body?.csrfToken ?? body?.data?.csrfToken;
  if (typeof returnedCsrf === 'string' && returnedCsrf) csrfToken = returnedCsrf;
  return normalizeResponse(body) as T;
}

export const api = {
  get: <T>(path: string, query?: Options['query'], signal?: AbortSignal) => request<T>(path, { query, signal }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string, body?: unknown) => request<T>(path, { method: 'DELETE', body }),
  clearCsrf: () => { csrfToken = null; },
};

export function asData<T>(value: any): T {
  return (value && Object.prototype.hasOwnProperty.call(value, 'data') ? value.data : value) as T;
}

export function asList<T>(value: any): T[] {
  const data = asData<any>(value);
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}
