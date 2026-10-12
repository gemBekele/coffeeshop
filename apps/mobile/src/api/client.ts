import { API_URL } from "../config";

export interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  token?: string;
  deviceKey?: string;
  body?: unknown;
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  if (options.deviceKey) headers["X-Device-Key"] = options.deviceKey;

  const res = await fetch(`${API_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const text = await res.text();
  let json: ApiEnvelope<T> = { success: false };
  try {
    json = JSON.parse(text) as ApiEnvelope<T>;
  } catch {
    throw new ApiError(res.status, `HTTP ${res.status}`);
  }
  if (!res.ok || !json.success) {
    throw new ApiError(res.status, json.error ?? `HTTP ${res.status}`);
  }
  return json.data as T;
}

/** Authenticated API bound to a token getter (read fresh each call). */
export function createApi(getToken: () => string | null, getDeviceKey: () => string | null) {
  const req = <T>(path: string, options: RequestOptions = {}) =>
    apiRequest<T>(path, {
      ...options,
      token: options.token ?? getToken() ?? undefined,
      deviceKey: options.deviceKey ?? getDeviceKey() ?? undefined,
    });

  return {
    // auth
    login: (identifier: string, pin?: string, password?: string) =>
      apiRequest<LoginResult>("/api/auth/login", {
        method: "POST",
        body: { identifier, pin, password },
      }),
    me: () => req<MeResult>("/api/auth/me"),

    // catalog
    categories: () => req<Category[]>("/api/catalog/categories"),
    products: () => req<Product[]>("/api/catalog/products"),
    createProduct: (body: unknown) =>
      req<Product>("/api/catalog/products", { method: "POST", body }),
    updateProduct: (id: string, body: unknown) =>
      req<Product>(`/api/catalog/products/${id}`, { method: "PATCH", body }),

    // inventory
    inventoryItems: () => req<InventoryItem[]>("/api/inventory/items"),
    createInventoryItem: (body: unknown) =>
      req<InventoryItem>("/api/inventory/items", { method: "POST", body }),
    stockMovement: (id: string, body: unknown) =>
      req(`/api/inventory/items/${id}/movements`, { method: "POST", body }),

    // orders
    orderBoard: () => req<Record<string, Order[]>>("/api/orders/board"),
    orders: () => req<{ items: Order[] }>("/api/orders"),
    order: (id: string) => req<Order>(`/api/orders/${id}`),
    createOrder: (body: unknown) =>
      req<Order>("/api/orders", { method: "POST", body }),
    updateOrderStatus: (id: string, status: string, note?: string) =>
      req<Order>(`/api/orders/${id}/status`, { method: "PATCH", body: { status, note } }),
    payCash: (id: string) =>
      req<Order>(`/api/orders/${id}/pay-cash`, { method: "POST" }),

    // payments
    payments: () => req<{ items: Payment[] }>("/api/payments"),
    unmatchedPayments: () => req<Payment[]>("/api/payments/unmatched"),
    verify: (txnId: string) =>
      req<VerifyResult>("/api/payments/verify", { method: "POST", body: { txnId } }),
    matchPayment: (id: string, orderId: string) =>
      req(`/api/payments/${id}/match`, { method: "POST", body: { orderId } }),
    unmatchPayment: (id: string) =>
      req(`/api/payments/${id}/unmatch`, { method: "POST" }),
    smsInbox: () => req<UnmatchedSms[]>("/api/payments/sms-inbox"),
    dismissSms: (id: string) =>
      req(`/api/payments/sms-inbox/${id}/dismiss`, { method: "POST" }),

    // templates
    templates: () => req<SmsTemplate[]>("/api/templates"),
    template: (id: string) => req<SmsTemplate>(`/api/templates/${id}`),
    createTemplate: (body: unknown) =>
      req<SmsTemplate>("/api/templates", { method: "POST", body }),
    updateTemplate: (id: string, body: unknown) =>
      req<SmsTemplate>(`/api/templates/${id}`, { method: "PATCH", body }),
    activateTemplate: (id: string) =>
      req<SmsTemplate>(`/api/templates/${id}/activate`, { method: "POST" }),
    archiveTemplate: (id: string) =>
      req<SmsTemplate>(`/api/templates/${id}/archive`, { method: "POST" }),
    testTemplate: (templateBody: string, smsText: string) =>
      req<TemplateDiagnostics>("/api/templates/test", {
        method: "POST",
        body: { templateBody, smsText },
      }),
    templateFromSms: (smsText: string, spans: Array<{ field: string; start: number; end: number }>) =>
      req<TemplateDiagnostics & { templateBody: string; suggestedFields: unknown[] }>(
        "/api/templates/from-sms",
        { method: "POST", body: { smsText, spans } },
      ),

    // devices
    registerDevice: (body: { label: string; role: string; platform: string }) =>
      req<{ device: Device; apiKey: string }>("/api/devices", { method: "POST", body }),
    deviceConfig: (deviceKey: string) =>
      apiRequest<DeviceConfig>("/api/devices/me/config", { deviceKey }),

    // reports
    reportSummary: () => req<ReportSummary>("/api/reports/summary"),
    reportTopProducts: () =>
      req<Array<{ name: string; quantity: number; revenue: number }>>(
        "/api/reports/top-products",
      ),
    reportInventory: () => req<ReportInventory>("/api/reports/inventory"),

    // staff
    staff: () => req<Staff[]>("/api/staff"),

    // sms ingest
    ingestSms: (body: unknown) =>
      apiRequest<IngestResult>("/api/payments/ingest", {
        method: "POST",
        deviceKey: getDeviceKey() ?? undefined,
        body,
      }),

    // QR pairing (activation)
    pairingRequest: (employeeCode: string) =>
      apiRequest<PairingRequest>("/api/pairing/request", {
        method: "POST",
        body: { employeeCode },
      }),
    pairingApprove: (token: string) =>
      req<PairingApproved>("/api/pairing/approve", {
        method: "POST",
        body: { token },
      }),
    pairingStatus: (token: string) =>
      apiRequest<PairingStatus>(`/api/pairing/status?token=${token}`),
    pairingList: () => req<PairingRow[]>("/api/pairing"),
  };
}

export interface PairingRequest {
  pairingId: string;
  code: string;
  token: string;
  staffName: string;
  role: string;
  shopName: string;
  expiresAt: string;
}

export interface PairingApproved {
  pairingId: string;
  code: string;
  staffId: string;
  staffName: string;
  approved: boolean;
}

export interface PairingStatus {
  approved: boolean;
  expired?: boolean;
  denied?: boolean;
  staffName?: string;
  shopName?: string;
  expiresAt?: string;
  accessToken?: string;
  refreshToken?: string;
  staff?: { id: string; fullName: string; role: StaffRole; shopId: string };
}

export interface PairingRow {
  id: string;
  code: string;
  status: string;
  createdAt: string;
  staff: { fullName: string; role: string };
}

export type Api = ReturnType<typeof createApi>;

/* ------------------------------- Domain types ---------------------------- */

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  staff: { id: string; fullName: string; role: StaffRole; shopId: string };
}

export type StaffRole = "OWNER" | "MANAGER" | "CASHIER" | "BARISTA";

export interface MeResult {
  id: string;
  fullName: string;
  role: StaffRole;
  shopId: string;
  shop: { id: string; name: string; currency: string; publicMenuSlug: string };
}

export interface Category {
  id: string;
  name: string;
  isActive: boolean;
}

export interface Variant {
  id: string;
  name: string;
  priceDelta: number;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  isActive: boolean;
  categoryId: string | null;
  variants: Variant[];
  recipeIngredients: Array<{ id: string; quantity: number; inventoryItem: { name: string; unit: string } }>;
}

export interface InventoryItem {
  id: string;
  name: string;
  unit: string;
  stockOnHand: number;
  reorderLevel: number;
  lowStock: boolean;
}

export interface OrderItem {
  id: string;
  nameSnapshot: string;
  quantity: number;
  lineTotal: number;
}

export interface Order {
  id: string;
  orderNumber: number;
  type: string;
  status: string;
  tableLabel: string | null;
  customerName: string | null;
  total: number;
  items: OrderItem[];
  createdAt: string;
}

export interface Payment {
  id: string;
  txnId: string;
  amount: number;
  sender: string | null;
  bank: string | null;
  status: string;
  orderId: string | null;
  receivedAt: string;
}

export interface VerifyResult {
  found: boolean;
  source: string | null;
  payment?: Payment;
  order?: Partial<Order> | null;
}

export interface UnmatchedSms {
  id: string;
  sender: string | null;
  body: string;
  receivedAt: string;
  resolvedAt: string | null;
}

export interface SmsTemplate {
  id: string;
  name: string;
  provider: string;
  direction: "CREDIT" | "DEBIT";
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  senderAllowlist: string[];
  templateBody: string;
  version: number;
  sampleSms: string | null;
}

export interface TemplateDiagnostics {
  regex: string;
  fields: string[];
  warnings: string[];
  hasAmount: boolean;
  errored: boolean;
  extraction: {
    matched: boolean;
    amount?: number;
    txnId?: string;
    missingRequired: string[];
  } | null;
}

export interface Device {
  id: string;
  label: string;
  role: string;
  platform: string;
  apiKeyPrefix: string;
  lastSeenAt: string | null;
  isActive: boolean;
}

export interface DeviceTemplate {
  id: string;
  name: string;
  provider: string;
  direction: "CREDIT" | "DEBIT";
  senderAllowlist: string[];
  version: number;
  templateBody: string;
  regex: string;
  flags: string;
  fields: string[];
  warnings: string[];
}

export interface DeviceConfig {
  device: { id: string; shopId: string; role: string; label: string };
  shop: { id: string; name: string; currency: string; timezone: string };
  templates: DeviceTemplate[];
}

export interface ReportSummary {
  orders: {
    paidCount: number;
    openCount: number;
    grossSales: number;
    taxCollected: number;
    netSales: number;
    averageOrderValue: number;
  };
  payments: Array<{ status: string; count: number; amount: number }>;
  lowStockCount: number;
}

export interface ReportInventory {
  items: Array<{ id: string; name: string; stockOnHand: number; unit: string; lowStock: boolean; value: number }>;
  totalValue: number;
  lowStockCount: number;
}

export interface Staff {
  id: string;
  fullName: string;
  role: StaffRole;
  phone: string | null;
  employeeCode: string | null;
  isActive: boolean;
}

export interface IngestResult {
  duplicate?: boolean;
  unmatched?: boolean;
  matched?: boolean;
  matchType?: string | null;
  payment?: Payment;
}
