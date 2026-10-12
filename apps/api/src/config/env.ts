import { existsSync } from "node:fs";
import { resolve } from "node:path";
import dotenv from "dotenv";
import { z } from "zod";

const candidates = [
  resolve(process.cwd(), ".env"),
  resolve(process.cwd(), "../../.env"),
];
for (const path of candidates) {
  if (existsSync(path)) {
    dotenv.config({ path });
    break;
  }
}

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  API_PORT: z.coerce.number().default(4000),
  API_HOST: z.string().default("0.0.0.0"),
  API_PUBLIC_URL: z.string().default("http://localhost:4000"),

  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().default("redis://localhost:6379"),

  JWT_ACCESS_SECRET: z.string().min(8),
  JWT_REFRESH_SECRET: z.string().min(8),
  JWT_ACCESS_TTL: z.string().default("15m"),
  JWT_REFRESH_TTL: z.string().default("30d"),
  STAFF_PIN_PEPPER: z.string().default("change-me-pin-pepper"),

  DEVICE_API_KEY_PREFIX: z.string().default("csd_"),
});

export const env = envSchema.parse(process.env);
export const isProd = env.NODE_ENV === "production";
