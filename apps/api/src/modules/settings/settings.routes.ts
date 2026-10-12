import { Router } from "express";
import { updateShopSchema } from "@coffeeshop/shared";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler, ok, AppError } from "../../lib/http.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { recordAudit } from "../../lib/audit.js";

const router = Router();
router.use(requireAuth);

function serializeShop(shop: {
  taxRate: unknown;
  [key: string]: unknown;
}) {
  return { ...shop, taxRate: Number(shop.taxRate) };
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const shop = await prisma.shop.findUnique({
      where: { id: req.staff!.shopId },
    });
    if (!shop) throw new AppError(404, "Shop not found");
    res.json(ok(serializeShop(shop)));
  }),
);

router.patch(
  "/",
  requireRole("OWNER", "MANAGER"),
  validate(updateShopSchema),
  asyncHandler(async (req, res) => {
    const input = req.body as Record<string, unknown>;

    if (typeof input.publicMenuSlug === "string") {
      const dupe = await prisma.shop.findUnique({
        where: { publicMenuSlug: input.publicMenuSlug },
        select: { id: true },
      });
      if (dupe && dupe.id !== req.staff!.shopId) {
        throw new AppError(409, "That menu slug is already taken");
      }
    }

    const shop = await prisma.shop.update({
      where: { id: req.staff!.shopId },
      data: input as never,
    });

    recordAudit({
      shopId: req.staff!.shopId,
      staffId: req.staff!.id,
      action: "settings.update",
      entity: "Shop",
      entityId: shop.id,
      ip: req.ip,
    });

    res.json(ok(serializeShop(shop)));
  }),
);

export default router;
