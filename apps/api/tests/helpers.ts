import { createServer, type Server } from "node:http";
import { createApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { getRedis } from "../src/lib/redis.js";

export interface TestServer {
  baseUrl: string;
  close: () => Promise<void>;
}

export async function startTestServer(): Promise<TestServer> {
  const app = createApp();
  const server: Server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
      }),
  };
}

export async function disconnectDb(): Promise<void> {
  await prisma.$disconnect();
  const redis = getRedis();
  if (redis) {
    try {
      await redis.quit();
    } catch {
      // ignore
    }
  }
}

export interface ApiResponse<T = unknown> {
  status: number;
  body: {
    success: boolean;
    data?: T;
    error?: string;
    details?: unknown;
  };
}

export class Client {
  token?: string;
  deviceKey?: string;

  constructor(private readonly baseUrl: string) {}

  async request<T = unknown>(
    method: string,
    path: string,
    body?: unknown,
    headers: Record<string, string> = {},
  ): Promise<ApiResponse<T>> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
        ...(this.deviceKey ? { "X-Device-Key": this.deviceKey } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let parsed: ApiResponse<T>["body"];
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { success: false, error: text };
    }
    return { status: res.status, body: parsed };
  }

  get<T = unknown>(path: string) {
    return this.request<T>("GET", path);
  }
  post<T = unknown>(path: string, body?: unknown) {
    return this.request<T>("POST", path, body);
  }
  patch<T = unknown>(path: string, body?: unknown) {
    return this.request<T>("PATCH", path, body);
  }
  put<T = unknown>(path: string, body?: unknown) {
    return this.request<T>("PUT", path, body);
  }
  del<T = unknown>(path: string) {
    return this.request<T>("DELETE", path);
  }
}

export const OWNER = {
  identifier: "owner@coffeeshop.local",
  pin: "1234",
  password: "owner12345",
};

export async function login(
  client: Client,
  credentials: { identifier: string; pin?: string; password?: string } = OWNER,
): Promise<string> {
  const res = await client.post<{
    accessToken: string;
    refreshToken: string;
    staff: { id: string; role: string; shopId: string };
  }>("/api/auth/login", credentials);
  if (!res.body.success || !res.body.data) {
    throw new Error(`Login failed: ${res.status} ${res.body.error}`);
  }
  client.token = res.body.data.accessToken;
  return res.body.data.accessToken;
}

/** Unique suffix so tests can run against a shared, pre-seeded database. */
export function unique(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}
