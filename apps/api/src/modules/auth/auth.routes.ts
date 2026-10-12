import { Router } from "express";
import { loginSchema, refreshSchema } from "@coffeeshop/shared";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler, ok, AppError } from "../../lib/http.js";
import { verifyPassword, verifyPin } from "../../lib/security.js";
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

const router = Router();

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
