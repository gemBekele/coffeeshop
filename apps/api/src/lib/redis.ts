import { Redis } from "ioredis";
import { env } from "../config/env.js";

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
      // Swallow: token store falls back to in-memory when Redis is down.
    });
    return client;
  } catch {
    return null;
  }
}

/** Simple async key/value store with in-memory fallback. */
interface StoredValue {
  value: string;
  expiresAt: number;
}

const memory = new Map<string, StoredValue>();

export const kv = {
  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    const redis = getRedis();
    if (redis && redis.status === "ready") {
      await redis.set(key, value, "EX", ttlSeconds);
      return;
    }
    memory.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  },

  async get(key: string): Promise<string | null> {
    const redis = getRedis();
    if (redis && redis.status === "ready") {
      return redis.get(key);
    }
    const entry = memory.get(key);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      memory.delete(key);
      return null;
    }
    return entry.value;
  },

  async del(key: string): Promise<void> {
    const redis = getRedis();
    if (redis && redis.status === "ready") {
      await redis.del(key);
      return;
    }
    memory.delete(key);
  },
};
