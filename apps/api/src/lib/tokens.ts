import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import type { JwtPayload, StaffRole } from "@coffeeshop/shared";
import { env } from "../config/env.js";
import { kv } from "./redis.js";
import { AppError } from "./http.js";

const ACCESS_TTL_SECONDS = 15 * 60;
const REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60;

export function signAccessToken(payload: {
  sub: string;
  role: StaffRole;
  shopId: string;
}): string {
  const body: JwtPayload = { ...payload, type: "access" };
  return jwt.sign(body, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_TTL,
  } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): JwtPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtPayload;
    if (decoded.type !== "access") throw new Error("wrong token type");
    return decoded;
  } catch {
    throw new AppError(401, "Invalid or expired access token");
  }
}

function refreshKey(jti: string): string {
  return `refresh:${jti}`;
}

export async function issueRefreshToken(payload: {
  sub: string;
  role: StaffRole;
  shopId: string;
}): Promise<string> {
  const jti = crypto.randomUUID();
  const body: JwtPayload = { ...payload, type: "refresh" };
  const token = jwt.sign({ ...body, jti }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_TTL,
  } as jwt.SignOptions);
  await kv.set(refreshKey(jti), payload.sub, REFRESH_TTL_SECONDS);
  return token;
}

export async function rotateRefreshToken(token: string): Promise<{
  accessToken: string;
  refreshToken: string;
  payload: JwtPayload;
}> {
  let decoded: JwtPayload & { jti?: string };
  try {
    decoded = jwt.verify(token, env.JWT_REFRESH_SECRET) as JwtPayload & {
      jti?: string;
    };
  } catch {
    throw new AppError(401, "Invalid or expired refresh token");
  }
  if (decoded.type !== "refresh" || !decoded.jti) {
    throw new AppError(401, "Invalid refresh token");
  }

  const stored = await kv.get(refreshKey(decoded.jti));
  if (stored !== decoded.sub) {
    throw new AppError(401, "Refresh token revoked");
  }
  await kv.del(refreshKey(decoded.jti));

  const base = {
    sub: decoded.sub,
    role: decoded.role,
    shopId: decoded.shopId,
  };
  const accessToken = signAccessToken(base);
  const refreshToken = await issueRefreshToken(base);
  return { accessToken, refreshToken, payload: decoded };
}

export async function revokeRefreshToken(token: string): Promise<void> {
  try {
    const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET) as JwtPayload & {
      jti?: string;
    };
    if (decoded.jti) await kv.del(refreshKey(decoded.jti));
  } catch {
    // ignore
  }
}

export const ACCESS_TOKEN_TTL_SECONDS = ACCESS_TTL_SECONDS;
export const REFRESH_TOKEN_TTL_SECONDS = REFRESH_TTL_SECONDS;
