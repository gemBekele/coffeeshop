import { Redis } from "ioredis";
import { env } from "../config/env.js";
import { prisma } from "./prisma.js";

let client: Redis | null = null;

export function getRedis(): Redis | null {
  if (client) return client;
  try {
    client = new Redis(env.REDIS_URL, {
      lazyConnect: false,
      maxRetriesPerRequest: 2,
      retryStrategy: (times: number) =>
        times > 5 ? null : Math.min(times * 200, 2000),
    });
    client.on("error", () => {
      // Swallow: token store falls back to the database when Redis is down.
    });
    return client;
  } catch {
    return null;
  }
}

const memory = new Map<string, { value: string; expiresAt: number }>();

/** True while Redis answered successfully at least once. */
function redisReady(redis: Redis | null): redis is Redis {
  return !!redis && redis.status === "ready";
}

/**
 * Simple async key/value store. Prefers Redis, then the database, then memory.
 *
 * The database layer matters in production: without it, refresh tokens would
 * vanish on every API restart and every phone would be forced to log in
 * again. Rows are lazily expired on read.
 */
export const kv = {
  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    const redis = getRedis();
    if (redisReady(redis)) {
      await redis.set(key, value, "EX", ttlSeconds);
      return;
    }
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    try {
      await prisma.kvEntry.upsert({
        where: { key },
        create: { key, value, expiresAt },
        update: { value, expiresAt },
      });
    } catch {
      memory.set(key, { value, expiresAt: expiresAt.getTime() });
    }
  },

  async get(key: string): Promise<string | null> {
    const redis = getRedis();
    if (redisReady(redis)) {
      return redis.get(key);
    }
    try {
      const row = await prisma.kvEntry.findUnique({ where: { key } });
      if (!row) {
        const local = memory.get(key);
        return local && local.expiresAt > Date.now() ? local.value : null;
      }
      if (row.expiresAt.getTime() < Date.now()) {
        await prisma.kvEntry.delete({ where: { key } }).catch(() => {});
        return null;
      }
      return row.value;
    } catch {
      const local = memory.get(key);
      if (!local) return null;
      if (local.expiresAt < Date.now()) {
        memory.delete(key);
        return null;
      }
      return local.value;
    }
  },

  async del(key: string): Promise<void> {
    const redis = getRedis();
    if (redisReady(redis)) {
      await redis.del(key);
    }
    memory.delete(key);
    try {
      await prisma.kvEntry.deleteMany({ where: { key } });
    } catch {
      // best effort
    }
  },
};
