export const STAFF_ROLES = ["OWNER", "MANAGER", "CASHIER", "BARISTA"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const ORDER_TYPES = ["DINE_IN", "TAKEAWAY"] as const;
export type OrderType = (typeof ORDER_TYPES)[number];

export const ORDER_STATUSES = [
  "OPEN",
  "CONFIRMED",
  "PREPARING",
  "READY",
  "SERVED",
  "PAID",
  "VOID",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_SOURCES = ["SMS", "OCR", "MANUAL", "NOTIFICATION"] as const;
export type PaymentSource = (typeof PAYMENT_SOURCES)[number];

export const PAYMENT_STATUSES = [
  "UNMATCHED",
  "MATCHED",
  "VERIFIED",
  "DUPLICATE",
  "REJECTED",
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const STOCK_MOVEMENT_TYPES = [
  "IN",
  "OUT",
  "ADJUST",
  "WASTE",
  "SALE",
] as const;
export type StockMovementType = (typeof STOCK_MOVEMENT_TYPES)[number];

export const TEMPLATE_STATUSES = ["DRAFT", "ACTIVE", "ARCHIVED"] as const;
export type TemplateStatus = (typeof TEMPLATE_STATUSES)[number];

export const SMS_PROVIDERS = [
  "TELEBIRR",
  "CBE_BIRR",
  "AMOLE",
  "AWASH",
  "OTHER",
] as const;
export type SmsProvider = (typeof SMS_PROVIDERS)[number];

export const TEMPLATE_DIRECTIONS = ["CREDIT", "DEBIT"] as const;
export type TemplateDirection = (typeof TEMPLATE_DIRECTIONS)[number];

export interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface JwtPayload {
  sub: string;
  role: StaffRole;
  shopId: string;
  type: "access" | "refresh";
}
