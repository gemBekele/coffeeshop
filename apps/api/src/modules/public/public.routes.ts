import { Router } from "express";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler, ok, AppError } from "../../lib/http.js";
import { serializeDecimals } from "../../lib/decimal.js";

const router = Router();

/**
 * Public, unauthenticated menu for QR codes.
 * Only active categories + active products are exposed.
 */
router.get(
  "/menu/:slug",
  asyncHandler(async (req, res) => {
    const slug = String(req.params.slug);
    const shop = await prisma.shop.findFirst({
      where: { publicMenuSlug: slug, isActive: true },
      select: { id: true, name: true, currency: true },
    });
    if (!shop) throw new AppError(404, "Menu not found");

    const categories = await prisma.category.findMany({
      where: { shopId: shop.id, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        products: {
          where: { isActive: true },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          select: {
            id: true,
            name: true,
            description: true,
            price: true,
            imageUrl: true,
          },
        },
      },
    });

    const data = {
      shop: { name: shop.name, currency: shop.currency },
      categories: categories
        .filter((c) => c.products.length > 0)
        .map((c) => ({
          id: c.id,
          name: c.name,
          products: serializeDecimals(c.products),
        })),
    };

    res.json(ok(data));
  }),
);

export default router;
