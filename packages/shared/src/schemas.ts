import { z } from "zod";
import {
  ORDER_STATUSES,
  ORDER_TYPES,
  PAYMENT_SOURCES,
  SMS_PROVIDERS,
  STAFF_ROLES,
  STOCK_MOVEMENT_TYPES,
  TEMPLATE_DIRECTIONS,
  TEMPLATE_STATUSES,
} from "./types.js";

export const idSchema = z.string().min(1);

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type Pagination = z.infer<typeof paginationSchema>;

// --- Auth ---
export const pinSchema = z
  .string()
  .regex(/^\d{4,8}$/, "PIN must be 4 to 8 digits");

export const loginSchema = z.object({
  identifier: z.string().min(3), // email, phone, or employee code
  password: z.string().min(6).optional(),
  pin: pinSchema.optional(),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const refreshSchema = z.object({
  refreshToken: z.string().min(10),
});

// --- Staff ---
export const createStaffSchema = z.object({
  fullName: z.string().min(2).max(120),
  email: z.string().email().optional(),
  phone: z.string().min(7).max(20).optional(),
  role: z.enum(STAFF_ROLES).default("BARISTA"),
  password: z.string().min(6).optional(),
  pin: pinSchema.optional(),
});
export type CreateStaffInput = z.infer<typeof createStaffSchema>;

export const updateStaffSchema = createStaffSchema.partial().extend({
  isActive: z.boolean().optional(),
});
export type UpdateStaffInput = z.infer<typeof updateStaffSchema>;

// --- Shifts ---
export const openShiftSchema = z.object({
  openingFloat: z.number().min(0).default(0),
  note: z.string().max(500).optional(),
});
export type OpenShiftInput = z.infer<typeof openShiftSchema>;

export const closeShiftSchema = z.object({
  closingCash: z.number().min(0),
  note: z.string().max(500).optional(),
});
export type CloseShiftInput = z.infer<typeof closeShiftSchema>;

// --- Shop settings ---
export const updateShopSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  phone: z.string().max(20).optional(),
  address: z.string().max(300).optional(),
  currency: z.string().length(3).optional(),
  timezone: z.string().max(64).optional(),
  taxRate: z.number().min(0).max(100).optional(),
  publicMenuSlug: z
    .string()
    .regex(/^[a-z0-9-]{2,60}$/, "lowercase letters, numbers and dashes")
    .optional(),
});
export type UpdateShopInput = z.infer<typeof updateShopSchema>;

// --- Orders ---
export const orderItemSchema = z.object({
  productId: idSchema,
  variantId: idSchema.optional(),
  quantity: z.number().int().min(1).default(1),
  note: z.string().max(300).optional(),
});

export const createOrderSchema = z.object({
  type: z.enum(ORDER_TYPES).default("DINE_IN"),
  tableLabel: z.string().max(40).optional(),
  customerName: z.string().max(120).optional(),
  customerPhone: z.string().max(20).optional(),
  customerTxnId: z.string().max(120).optional(),
  note: z.string().max(500).optional(),
  items: z.array(orderItemSchema).min(1),
});
export type CreateOrderInput = z.infer<typeof createOrderSchema>;

export const updateOrderStatusSchema = z.object({
  status: z.enum(ORDER_STATUSES),
  note: z.string().max(300).optional(),
});

export const updateOrderSchema = z.object({
  tableLabel: z.string().max(40).optional(),
  customerName: z.string().max(120).optional(),
  customerPhone: z.string().max(20).optional(),
  customerTxnId: z.string().max(120).nullish(),
  note: z.string().max(500).optional(),
});
export type UpdateOrderInput = z.infer<typeof updateOrderSchema>;

// --- Public menu ---
export const publicSlugSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]{2,60}$/),
});

// --- Payments ---
export const ingestPaymentSchema = z.object({
  txnId: z.string().min(1).max(160),
  referenceTxnId: z.string().max(160).optional(),
  amount: z.number().min(0),
  currency: z.string().length(3).optional(),
  sender: z.string().max(200).optional(),
  senderPhone: z.string().max(40).optional(),
  bank: z.string().max(80).optional(),
  direction: z.enum(TEMPLATE_DIRECTIONS).default("CREDIT"),
  rawSms: z.string().min(1).max(4000),
  templateId: z.string().optional(),
  provider: z.enum(SMS_PROVIDERS).optional(),
  receivedAt: z.coerce.date().optional(),
  source: z.enum(PAYMENT_SOURCES).default("SMS"),
});
export type IngestPaymentInput = z.infer<typeof ingestPaymentSchema>;

export const verifyPaymentSchema = z.object({
  txnId: z.string().min(1).max(160),
});

export const matchPaymentSchema = z.object({
  orderId: idSchema,
});

// --- SMS Templates ---
export const templateFieldSchema = z.object({
  field: z.string(),
  required: z.boolean().optional(),
});

export const createTemplateSchema = z.object({
  name: z.string().min(2).max(120),
  provider: z.enum(SMS_PROVIDERS).default("OTHER"),
  senderAllowlist: z.array(z.string().max(40)).default([]),
  templateBody: z.string().min(3).max(4000),
  direction: z.enum(TEMPLATE_DIRECTIONS).default("CREDIT"),
  status: z.enum(TEMPLATE_STATUSES).default("DRAFT"),
  sampleSms: z.string().max(4000).optional(),
});
export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;

export const updateTemplateSchema = createTemplateSchema.partial();
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;

export const testTemplateSchema = z.object({
  templateBody: z.string().min(3).max(4000),
  smsText: z.string().min(1).max(4000),
});
export type TestTemplateInput = z.infer<typeof testTemplateSchema>;

export const templateFromSmsSchema = z.object({
  smsText: z.string().min(1).max(4000),
  spans: z
    .array(
      z.object({
        field: z.string(),
        start: z.number().int().min(0),
        end: z.number().int().min(0),
      }),
    )
    .min(1),
});
export type TemplateFromSmsInput = z.infer<typeof templateFromSmsSchema>;

// --- Devices ---
export const registerDeviceSchema = z.object({
  label: z.string().min(1).max(80),
  role: z.enum(STAFF_ROLES),
  platform: z.enum(["android", "ios"]).default("android"),
});
export type RegisterDeviceInput = z.infer<typeof registerDeviceSchema>;

// --- Catalog: categories ---
export const createCategorySchema = z.object({
  name: z.string().min(1).max(80),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export const updateCategorySchema = createCategorySchema.partial();
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

// --- Catalog: products ---
export const variantInputSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1).max(80),
  priceDelta: z.number().default(0),
  isActive: z.boolean().optional(),
});
export type VariantInput = z.infer<typeof variantInputSchema>;

export const recipeInputSchema = z.object({
  inventoryItemId: idSchema,
  quantity: z.number().positive(),
});
export type RecipeInput = z.infer<typeof recipeInputSchema>;

export const createProductSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  categoryId: idSchema.nullable().optional(),
  price: z.number().min(0),
  imageUrl: z.string().max(500).optional(),
  trackInventory: z.boolean().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  variants: z.array(variantInputSchema).optional(),
  recipe: z.array(recipeInputSchema).optional(),
});
export type CreateProductInput = z.infer<typeof createProductSchema>;

export const updateProductSchema = createProductSchema.partial();
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

export const setRecipeSchema = z.object({
  ingredients: z.array(recipeInputSchema),
});
export type SetRecipeInput = z.infer<typeof setRecipeSchema>;

// --- Inventory ---
export const createInventoryItemSchema = z.object({
  name: z.string().min(1).max(120),
  unit: z.string().min(1).max(20).default("pcs"),
  stockOnHand: z.number().min(0).optional(),
  reorderLevel: z.number().min(0).optional(),
  cost: z.number().min(0).optional(),
  isActive: z.boolean().optional(),
});
export type CreateInventoryItemInput = z.infer<
  typeof createInventoryItemSchema
>;

export const updateInventoryItemSchema = createInventoryItemSchema.partial();
export type UpdateInventoryItemInput = z.infer<
  typeof updateInventoryItemSchema
>;

export const stockMovementSchema = z.object({
  type: z.enum(STOCK_MOVEMENT_TYPES),
  quantity: z.number().refine((n) => n !== 0, "Quantity cannot be zero"),
  reason: z.string().max(300).optional(),
});
export type StockMovementInput = z.infer<typeof stockMovementSchema>;

export const lowStockQuerySchema = z.object({
  lowOnly: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .optional()
    .transform((v) => v === "true" || v === true),
});
