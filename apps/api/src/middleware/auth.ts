import type { NextFunction, Request, Response } from "express";
import type { StaffRole } from "@coffeeshop/shared";
import { prisma } from "../lib/prisma.js";
import { hashDeviceKey } from "../lib/security.js";
import { AppError } from "../lib/http.js";
import { verifyAccessToken } from "../lib/tokens.js";

export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  try {
    const header = req.header("authorization") ?? "";
    const [scheme, token] = header.split(" ");
    if (scheme?.toLowerCase() !== "bearer" || !token) {
      throw new AppError(401, "Missing bearer token");
    }

    const payload = verifyAccessToken(token);
    const staff = await prisma.staff.findUnique({
      where: { id: payload.sub },
      select: { id: true, role: true, shopId: true, fullName: true, isActive: true },
    });
    if (!staff || !staff.isActive) {
      throw new AppError(401, "Account is inactive");
    }

    req.staff = {
      id: staff.id,
      role: staff.role as StaffRole,
      shopId: staff.shopId,
      fullName: staff.fullName,
    };
    next();
  } catch (err) {
    next(err);
  }
}

export function requireRole(...roles: StaffRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.staff) {
      next(new AppError(401, "Not authenticated"));
      return;
    }
    if (!roles.includes(req.staff.role)) {
      next(new AppError(403, "Insufficient permissions"));
      return;
    }
    next();
  };
}

/**
 * Authenticates a paired mobile device via its API key (X-Device-Key).
 * Used for the owner-phone SMS ingest endpoint.
 */
export async function authenticateDevice(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  try {
    const key = req.header("x-device-key");
    if (!key) {
      throw new AppError(401, "Missing device key");
    }

    const device = await prisma.device.findUnique({
      where: { apiKeyHash: hashDeviceKey(key) },
      select: { id: true, shopId: true, role: true, label: true, isActive: true },
    });
    if (!device || !device.isActive) {
      throw new AppError(401, "Invalid or inactive device key");
    }

    req.device = {
      id: device.id,
      shopId: device.shopId,
      role: device.role as StaffRole,
      label: device.label,
    };

    // Fire-and-forget heartbeat.
    prisma.device
      .update({ where: { id: device.id }, data: { lastSeenAt: new Date() } })
      .catch(() => {});

    next();
  } catch (err) {
    next(err);
  }
}
