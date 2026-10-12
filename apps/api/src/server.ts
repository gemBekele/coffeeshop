import { createServer } from "node:http";
import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./lib/prisma.js";
import { getRedis } from "./lib/redis.js";
import { initRealtime } from "./realtime/socket.js";

async function main() {
  const app = createApp();
  const httpServer = createServer(app);

  initRealtime(httpServer, env.API_PUBLIC_URL);

  try {
    await prisma.$connect();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[api] failed to connect to database", err);
    process.exit(1);
  }

  // Warm up Redis (optional; kv falls back to memory).
  getRedis();

  httpServer.listen(env.API_PORT, env.API_HOST, () => {
    // eslint-disable-next-line no-console
    console.log(
      `[api] listening on http://${env.API_HOST}:${env.API_PORT} (${env.NODE_ENV})`,
    );
  });

  const shutdown = async (signal: string) => {
    // eslint-disable-next-line no-console
    console.log(`[api] ${signal} received, shutting down`);
    httpServer.close();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

void main();
