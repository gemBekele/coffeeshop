import { Router } from "express";
import {
  createCategorySchema,
  updateCategorySchema,
  createProductSchema,
  updateProductSchema,
  setRecipeSchema,
} from "@coffeeshop/shared";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler, ok, AppError } from "../../lib/http.js";
import { serializeDecimals } from "../../lib/decimal.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { recordAudit } from "../../lib/audit.js";

const router = Router();
router.use(requireAuth);

const productInclude = {
  category: { select: { id: true, name: true } },
  variants: { orderBy: { name: "asc" as const } },
  recipeIngredients: {
    include: {
      inventoryItem: { select: { id: true, name: true, unit: true } },
    },
  },
};

async function assertInventoryItemsInShop(
  shopId: string,
  ids: string[],
): Promise<void> {
  if (ids.length === 0) return;
  const count = await prisma.inventoryItem.count({
    where: { shopId, id: { in: ids } },
  });
  if (count !== new Set(ids).size) {
    throw new AppError(400, "One or more inventory items were not found");
  }
}

/* ------------------------------- Categories ------------------------------ */

router.get(
  "/categories",
  asyncHandler(async (req, res) => {
    const categories = await prisma.category.findMany({
      where: { shopId: req.staff!.shopId },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { _count: { select: { products: true } } },
    });
    res.json(ok(categories));
  }),
);

router.post(
  "/categories",
  requireRole("OWNER", "MANAGER"),
  validate(createCategorySchema),
  asyncHandler(async (req, res) => {
    const input = req.body as {
      name: string;
      sortOrder?: number;
      isActive?: boolean;
    };
    const dupe = await prisma.category.findFirst({
      where: { shopId: req.staff!.shopId, name: input.name },
      select: { id: true },
    });
    if (dupe) throw new AppError(409, "A category with that name already exists");

    const category = await prisma.category.create({
      data: { ...input, shopId: req.staff!.shopId },
    });
    recordAudit({
      shopId: req.staff!.shopId,
      staffId: req.staff!.id,
      action: "category.create",
      entity: "Category",
      entityId: category.id,
      ip: req.ip,
    });
    res.status(201).json(ok(category));
  }),
);

router.patch(
  "/categories/:id",
  requireRole("OWNER", "MANAGER"),
  validate(updateCategorySchema),
  asyncHandler(async (req, res) => {
    const existing = await prisma.category.findFirst({
      where: { id: String(req.params.id), shopId: req.staff!.shopId },
    });
    if (!existing) throw new AppError(404, "Category not found");

    const category = await prisma.category.update({
      where: { id: existing.id },
      data: req.body as never,
    });
    res.json(ok(category));
  }),
);

router.delete(
  "/categories/:id",
  requireRole("OWNER", "MANAGER"),
  asyncHandler(async (req, res) => {
    const existing = await prisma.category.findFirst({
      where: { id: String(req.params.id), shopId: req.staff!.shopId },
    });
    if (!existing) throw new AppError(404, "Category not found");

    await prisma.category.update({
      where: { id: existing.id },
      data: { isActive: false },
    });
    recordAudit({
      shopId: req.staff!.shopId,
      staffId: req.staff!.id,
      action: "category.archive",
      entity: "Category",
      entityId: existing.id,
      ip: req.ip,
    });
    res.json(ok({ archived: true }));
  }),
);

/* -------------------------------- Products ------------------------------- */

router.get(
  "/products",
  asyncHandler(async (req, res) => {
    const query = req.query as Record<string, string | undefined>;
    const categoryId = query.categoryId;
    const activeOnly = query.activeOnly !== "false";

    const products = await prisma.product.findMany({
      where: {
        shopId: req.staff!.shopId,
        ...(categoryId ? { categoryId } : {}),
        ...(activeOnly ? { isActive: true } : {}),
      },
      include: productInclude,
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
    res.json(ok(serializeDecimals(products)));
  }),
);

router.get(
  "/products/:id",
  asyncHandler(async (req, res) => {
    const product = await prisma.product.findFirst({
      where: { id: String(req.params.id), shopId: req.staff!.shopId },
      include: productInclude,
    });
    if (!product) throw new AppError(404, "Product not found");
    res.json(ok(serializeDecimals(product)));
  }),
);

router.post(
  "/products",
  requireRole("OWNER", "MANAGER"),
  validate(createProductSchema),
  asyncHandler(async (req, res) => {
    const input = req.body as {
      name: string;
      description?: string;
      categoryId?: string | null;
      price: number;
      imageUrl?: string;
      trackInventory?: boolean;
      isActive?: boolean;
      sortOrder?: number;
      variants?: Array<{ name: string; priceDelta: number; isActive?: boolean }>;
      recipe?: Array<{ inventoryItemId: string; quantity: number }>;
    };

    if (input.categoryId) {
      const category = await prisma.category.findFirst({
        where: { id: input.categoryId, shopId: req.staff!.shopId },
      });
      if (!category) throw new AppError(400, "Category not found");
    }
    await assertInventoryItemsInShop(
      req.staff!.shopId,
      (input.recipe ?? []).map((r) => r.inventoryItemId),
    );

    const product = await prisma.product.create({
      data: {
        shopId: req.staff!.shopId,
        name: input.name,
        description: input.description,
        categoryId: input.categoryId ?? null,
        price: input.price,
        imageUrl: input.imageUrl,
        trackInventory: input.trackInventory ?? false,
        isActive: input.isActive ?? true,
        sortOrder: input.sortOrder ?? 0,
        variants: input.variants ? { create: input.variants } : undefined,
        recipeIngredients: input.recipe
          ? {
              create: input.recipe.map((r) => ({
                inventoryItemId: r.inventoryItemId,
                quantity: r.quantity,
              })),
            }
          : undefined,
      },
      include: productInclude,
    });

    recordAudit({
      shopId: req.staff!.shopId,
      staffId: req.staff!.id,
      action: "product.create",
      entity: "Product",
      entityId: product.id,
      ip: req.ip,
    });
    res.status(201).json(ok(serializeDecimals(product)));
  }),
);

router.patch(
  "/products/:id",
  requireRole("OWNER", "MANAGER"),
  validate(updateProductSchema),
  asyncHandler(async (req, res) => {
    const existing = await prisma.product.findFirst({
      where: { id: String(req.params.id), shopId: req.staff!.shopId },
    });
    if (!existing) throw new AppError(404, "Product not found");

    const input = req.body as {
      name?: string;
      description?: string;
      categoryId?: string | null;
      price?: number;
      imageUrl?: string;
      trackInventory?: boolean;
      isActive?: boolean;
      sortOrder?: number;
      variants?: Array<{ name: string; priceDelta: number; isActive?: boolean }>;
      recipe?: Array<{ inventoryItemId: string; quantity: number }>;
    };

    if (input.categoryId) {
      const category = await prisma.category.findFirst({
        where: { id: input.categoryId, shopId: req.staff!.shopId },
      });
      if (!category) throw new AppError(400, "Category not found");
    }
    await assertInventoryItemsInShop(
      req.staff!.shopId,
      (input.recipe ?? []).map((r) => r.inventoryItemId),
    );

    await prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id: existing.id },
        data: {
          name: input.name,
          description: input.description,
          categoryId: input.categoryId,
          price: input.price,
          imageUrl: input.imageUrl,
          trackInventory: input.trackInventory,
          isActive: input.isActive,
          sortOrder: input.sortOrder,
        },
      });

      if (input.variants) {
        await tx.productVariant.deleteMany({ where: { productId: existing.id } });
        if (input.variants.length > 0) {
          await tx.productVariant.createMany({
            data: input.variants.map((v) => ({
              productId: existing.id,
              name: v.name,
              priceDelta: v.priceDelta,
              isActive: v.isActive ?? true,
            })),
          });
        }
      }

      if (input.recipe) {
        await tx.recipeIngredient.deleteMany({ where: { productId: existing.id } });
        if (input.recipe.length > 0) {
          await tx.recipeIngredient.createMany({
            data: input.recipe.map((r) => ({
              productId: existing.id,
              inventoryItemId: r.inventoryItemId,
              quantity: r.quantity,
            })),
          });
        }
      }
    });

    const product = await prisma.product.findUnique({
      where: { id: existing.id },
      include: productInclude,
    });

    recordAudit({
      shopId: req.staff!.shopId,
      staffId: req.staff!.id,
      action: "product.update",
      entity: "Product",
      entityId: existing.id,
      ip: req.ip,
    });
    res.json(ok(serializeDecimals(product)));
  }),
);

router.delete(
  "/products/:id",
  requireRole("OWNER", "MANAGER"),
  asyncHandler(async (req, res) => {
    const existing = await prisma.product.findFirst({
      where: { id: String(req.params.id), shopId: req.staff!.shopId },
    });
    if (!existing) throw new AppError(404, "Product not found");
    await prisma.product.update({
      where: { id: existing.id },
      data: { isActive: false },
    });
    recordAudit({
      shopId: req.staff!.shopId,
      staffId: req.staff!.id,
      action: "product.archive",
      entity: "Product",
      entityId: existing.id,
      ip: req.ip,
    });
    res.json(ok({ archived: true }));
  }),
);

router.put(
  "/products/:id/recipe",
  requireRole("OWNER", "MANAGER"),
  validate(setRecipeSchema),
  asyncHandler(async (req, res) => {
    const existing = await prisma.product.findFirst({
      where: { id: String(req.params.id), shopId: req.staff!.shopId },
    });
    if (!existing) throw new AppError(404, "Product not found");

    const { ingredients } = req.body as {
      ingredients: Array<{ inventoryItemId: string; quantity: number }>;
    };
    await assertInventoryItemsInShop(
      req.staff!.shopId,
      ingredients.map((r) => r.inventoryItemId),
    );

    await prisma.$transaction(async (tx) => {
      await tx.recipeIngredient.deleteMany({ where: { productId: existing.id } });
      if (ingredients.length > 0) {
        await tx.recipeIngredient.createMany({
          data: ingredients.map((r) => ({
            productId: existing.id,
            inventoryItemId: r.inventoryItemId,
            quantity: r.quantity,
          })),
        });
      }
    });

    const product = await prisma.product.findUnique({
      where: { id: existing.id },
      include: productInclude,
    });
    recordAudit({
      shopId: req.staff!.shopId,
      staffId: req.staff!.id,
      action: "product.setRecipe",
      entity: "Product",
      entityId: existing.id,
      ip: req.ip,
    });
    res.json(ok(serializeDecimals(product)));
  }),
);

export default router;
