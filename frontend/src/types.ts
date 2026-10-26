export type Id = string | number;

export interface User {
  id: Id;
  username?: string;
  displayName: string;
  role: string;
  avatarUrl?: string | null;
  permissions: string[];
  enabled?: boolean;
  lastLoginAt?: string | null;
}

export interface Group {
  id: Id;
  name: string;
  type: string;
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
  method?: string;
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
}

export interface AuditLog {
  id: Id;
  userName?: string;
  action: string;
  entityType?: string;
  entityId?: Id;
  ipAddress?: string;
  createdAt: string;
  details?: Record<string, unknown>;
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
