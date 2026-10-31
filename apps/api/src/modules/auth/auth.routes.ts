import crypto from "node:crypto";
import { Router } from "express";
import { loginSchema, refreshSchema, registerSchema } from "@coffeeshop/shared";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler, ok, AppError } from "../../lib/http.js";
import { verifyPassword, verifyPin, hashPin } from "../../lib/security.js";
import {
  issueRefreshToken,
  revokeRefreshToken,
  rotateRefreshToken,
  signAccessToken,
  ACCESS_TOKEN_TTL_SECONDS,
} from "../../lib/tokens.js";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { recordAudit } from "../../lib/audit.js";
import { seedStarterTemplates } from "../../lib/shopDefaults.js";

const router = Router();


/* ------------------------------ Registration ----------------------------- */

function slugBase(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return base || "shop";
}

async function uniqueSlug(name: string): Promise<string> {
  const base = slugBase(name);
  for (let attempt = 0; attempt < 25; attempt++) {
    const slug =
      attempt === 0
        ? base
        : `${base}-${crypto.randomBytes(2).toString("hex")}`;
    const existing = await prisma.shop.findUnique({
      where: { publicMenuSlug: slug },
      select: { id: true },
    });
    if (!existing) return slug;
  }
  return `${base}-${Date.now().toString(36)}`;
}

async function uniqueEmployeeCode(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = `CS-${Math.floor(1000 + Math.random() * 9000)}`;
    const existing = await prisma.staff.findUnique({
      where: { employeeCode: code },
      select: { id: true },
    });
    if (!existing) return code;
  }
  return `CS-${Date.now().toString().slice(-6)}`;
}

/**
 * First-run onboarding: the owner creates the shop and their own account.
 * Starts with a clean shop and active payment templates.
 */
router.post(
  "/register",
  validate(registerSchema),
  asyncHandler(async (req, res) => {
    const { shopName, fullName, identifier, pin } = req.body as {
      shopName: string;
      fullName: string;
      identifier: string;
      pin: string;
    };

    const trimmed = identifier.trim();
    const isEmail = trimmed.includes("@");
    const email = isEmail ? trimmed.toLowerCase() : undefined;
    const phone = isEmail ? undefined : trimmed;

    const dupe = email
      ? await prisma.staff.findUnique({ where: { email }, select: { id: true } })
      : await prisma.staff.findUnique({ where: { phone }, select: { id: true } });
    if (dupe) {
      throw new AppError(
        409,
        isEmail ? "An account already uses this email" : "An account already uses this phone",
      );
    }

    const slug = await uniqueSlug(shopName);
    const employeeCode = await uniqueEmployeeCode();
    const pinHash = await hashPin(pin);

    const { shop, owner } = await prisma.$transaction(async (tx) => {
      const shop = await tx.shop.create({
        data: {
          name: shopName.trim(),
          publicMenuSlug: slug,
          currency: "ETB",
          paymentMaxAmount: 1000,
        },
      });
      const owner = await tx.staff.create({
        data: {
          shopId: shop.id,
          fullName: fullName.trim(),
          email,
          phone,
          role: "OWNER",
          employeeCode,
          pinHash,
        },
      });
      return { shop, owner };
    });

    await seedStarterTemplates(shop.id, owner.id);

    const base = { sub: owner.id, role: "OWNER" as never, shopId: shop.id };
    const accessToken = signAccessToken(base);
    const refreshToken = await issueRefreshToken(base);

    await prisma.staff.update({
      where: { id: owner.id },
      data: { lastLoginAt: new Date() },
    });
    recordAudit({
      shopId: shop.id,
      staffId: owner.id,
      action: "auth.register",
      ip: req.ip,
    });

    res.status(201).json(
      ok({
        accessToken,
        refreshToken,
        expiresIn: ACCESS_TOKEN_TTL_SECONDS,
        staff: {
          id: owner.id,
          fullName: owner.fullName,
          role: owner.role,
          shopId: shop.id,
          email: owner.email,
          phone: owner.phone,
        },
        shop: {
          id: shop.id,
          name: shop.name,
          currency: shop.currency,
          publicMenuSlug: shop.publicMenuSlug,
        },
      }),
    );
  }),
);

router.post(
  "/login",
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const { identifier, password, pin } = req.body as {
      identifier: string;
      password?: string;
      pin?: string;
    };

    const staff = await prisma.staff.findFirst({
      where: {
        OR: [
          { email: identifier },
          { phone: identifier },
          { employeeCode: identifier },
        ],
      },
    });

    if (!staff || !staff.isActive) {
      throw new AppError(401, "Invalid credentials");
    }

    let valid = false;
    if (pin) {
      valid = staff.pinHash ? await verifyPin(pin, staff.pinHash) : false;
    } else if (password) {
      valid = staff.passwordHash
        ? await verifyPassword(password, staff.passwordHash)
        : false;
    }
    if (!valid) {
      throw new AppError(401, "Invalid credentials");
    }

    const base = {
      sub: staff.id,
      role: staff.role as never,
      shopId: staff.shopId,
    };
    const accessToken = signAccessToken(base);
    const refreshToken = await issueRefreshToken(base);

    await prisma.staff.update({
      where: { id: staff.id },
      data: { lastLoginAt: new Date() },
    });
    recordAudit({
      shopId: staff.shopId,
      staffId: staff.id,
      action: "auth.login",
      ip: req.ip,
    });

    res.json(
      ok({
        accessToken,
        refreshToken,
        expiresIn: ACCESS_TOKEN_TTL_SECONDS,
        staff: {
          id: staff.id,
          fullName: staff.fullName,
          role: staff.role,
          shopId: staff.shopId,
          email: staff.email,
          phone: staff.phone,
        },
      }),
    );
  }),
);

router.post(
  "/refresh",
  validate(refreshSchema),
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body as { refreshToken: string };
    const rotated = await rotateRefreshToken(refreshToken);
    res.json(
      ok({
        accessToken: rotated.accessToken,
        refreshToken: rotated.refreshToken,
        expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      }),
    );
  }),
);

router.post(
  "/logout",
  validate(refreshSchema),
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body as { refreshToken: string };
    await revokeRefreshToken(refreshToken);
    res.json(ok({ loggedOut: true }));
  }),
);

router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const staff = await prisma.staff.findUnique({
      where: { id: req.staff!.id },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        role: true,
        shopId: true,
        shop: { select: { id: true, name: true, currency: true, publicMenuSlug: true } },
      },
    });
    if (!staff) throw new AppError(404, "Staff not found");
    res.json(ok(staff));
  }),
);

export default router;
