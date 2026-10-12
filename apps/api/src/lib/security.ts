import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { env } from "../config/env.js";
import { AppError } from "./http.js";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(`${pin}${env.STAFF_PIN_PEPPER}`, 10);
}

export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  return bcrypt.compare(`${pin}${env.STAFF_PIN_PEPPER}`, hash);
}

/**
 * Device API keys are high-entropy, so a fast SHA-256 digest is sufficient
 * (unlike user passwords which need a slow KDF).
 */
export function generateDeviceKey(): {
  plaintext: string;
  hash: string;
  prefix: string;
} {
  const raw = crypto.randomBytes(32).toString("base64url");
  const plaintext = `${env.DEVICE_API_KEY_PREFIX}${raw}`;
  const hash = hashDeviceKey(plaintext);
  const prefix = plaintext.slice(0, env.DEVICE_API_KEY_PREFIX.length + 6);
  return { plaintext, hash, prefix };
}

export function hashDeviceKey(plaintext: string): string {
  return crypto.createHash("sha256").update(plaintext).digest("hex");
}

export function assertStrongEnoughPin(pin: string): void {
  if (!/^\d{4,8}$/.test(pin)) {
    throw new AppError(400, "PIN must be 4 to 8 digits");
  }
}
