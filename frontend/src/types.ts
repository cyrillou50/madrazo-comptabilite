import type { Appearance } from './lib/appearance';

export type Id = string | number;

export interface Preferences {
  organizationName: string;
  currency: string;
  debtWarningDays: number;
  defaultPageSize: number;
  launderingFeePercent: number;
  appearance?: Partial<Appearance>;
}

export interface User {
  id: Id;
  username?: string;
  displayName: string;
  roleId?: Id;
  roleCode?: string;
  role: string;
  avatarUrl?: string | null;
  permissions: string[];
  enabled?: boolean;
  lastLoginAt?: string | null;
  preferences?: Partial<Preferences>;
}

export interface Group {
  id: Id;
  name: string;
  typeId?: Id | null;
  typeName?: string | null;
  blockOrders?: boolean | number;
  manager?: string | null;
  phone?: string | null;
  description?: string | null;
  status: string;
  notes?: string | null;
  totalPurchases?: number;
  debt?: number;
  contactsCount?: number;
  lastActivityAt?: string | null;
  createdAt?: string;
}

export interface Contact {
  id: Id;
  firstName: string;
  lastName: string;
  nickname?: string | null;
  phone?: string | null;
  groupId?: Id | null;
  groupName?: string | null;
  role?: string | null;
  status: string;
  notes?: string | null;
  lastContactAt?: string | null;
}

export interface Item {
  id: Id;
  name: string;
  categoryId?: Id;
  categoryName?: string;
  reference: string;
  description?: string | null;
  unitCost: number;
  defaultPrice: number;
  minimumPrice?: number;
  unit: string;
  stock: number;
  reservedStock?: number;
  alertThreshold: number;
  active: boolean;
  margin?: number;
}

export interface OrderLine {
  id?: Id;
  itemId: Id;
  itemName?: string;
  quantity: number;
  deliveredQuantity?: number;
  unitPrice?: number;
  discount?: number;
  total?: number;
}

export interface Order {
  id: Id;
  reference: string;
  groupId?: Id | null;
  groupName?: string | null;
  contactId?: Id | null;
  sellerName?: string;
  orderDate: string;
  items?: OrderLine[];
  totalAmount: number;
  totalCost?: number;
  estimatedMargin?: number;
  paidAmount?: number;
  remainingAmount?: number;
  status: string;
  paymentStatus: string;
  notes?: string | null;
}

export interface Payment {
  id: Id;
  orderId: Id;
  orderReference: string;
  groupName?: string;
  amount: number;
  paymentDate: string;
  paymentMethodId?: Id | null;
  method?: string | null;
  notes?: string | null;
  cancelledAt?: string | null;
}

export interface Expense {
  id: Id;
  label: string;
  category: string;
  amount: number;
  expenseDate: string;
  notes?: string | null;
  userName?: string;
}

export type AuditData = Record<string, any> | null;

export type Fund = 'clean' | 'dirty';

export interface FundBalances { cleanCents: number; dirtyCents: number; totalCents: number }

export interface LedgerEntry {
  id: Id;
  occurredAt: string;
  type: string;
  typeLabel: string;
  fund: Fund;
  label: string;
  amount: number;
  sourceType: string | null;
  sourceId: Id | null;
  userName?: string;
  reversed: boolean;
}

export interface AuditLog {
  id: Id;
  userName?: string;
  actorUsername?: string | null;
  action: string;
  entityType?: string;
  entityId?: Id;
  ipAddress?: string;
  createdAt: string;
  beforeData?: AuditData;
  afterData?: AuditData;
}

export interface NotificationAlert {
  id: 'stock' | 'orders' | 'debts';
  count: number;
  outOfStock?: number;
  names?: string[];
  remainingAmount?: number;
  days?: number;
  changedAt?: string | null;
  unread: boolean;
}

export interface NotificationEvent {
  id: Id;
  action: string;
  entityType?: string;
  entityId?: Id;
  actorName?: string | null;
  userName?: string | null;
  createdAt: string;
  beforeData?: AuditData;
  afterData?: AuditData;
  unread: boolean;
}

export interface NotificationsData {
  seenAt: string | null;
  unreadCount: number;
  alerts: NotificationAlert[];
  events: NotificationEvent[];
}

export interface TreasuryOverview {
  cleanBalance: number;
  dirtyBalance: number;
  launderedDirty: number;
  launderedClean: number;
  launderingFees: number;
  launderingCount: number;
  depositsClean: number;
  depositsDirty: number;
  timeline: Array<{ date: string; clean: number; dirty: number }>;
}

export interface DashboardData {
  totals: {
    received: number;
    revenue: number;
    grossProfit: number;
    expenses: number;
    cashBalance: number;
    outstandingDebt: number;
    salesCount: number;
    groupsCount: number;
    contactsCount: number;
    pendingOrders: number;
    lowStockItems: number;
  };
  receivedDirty?: number;
  paymentsByMethod?: Array<{ name: string; fund: Fund; amount: number }>;
  /** Absent pour les rôles qui n'ont pas accès aux finances. */
  treasury?: TreasuryOverview | null;
  salesTrend: Array<{ date: string; sales: number; received: number; profit: number }>;
  salesByItem: Array<{ name: string; value: number }>;
  activeGroups: Array<{ name: string; amount: number; orders: number }>;
  topItems: Array<{ name: string; quantity: number; amount: number }>;
  recentOrders: Order[];
  lowStock: Item[];
}

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages?: number;
}

export interface PageResult<T> { data: T[]; meta?: PageMeta }
