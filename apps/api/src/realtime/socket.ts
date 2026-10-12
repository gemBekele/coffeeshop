import type { Server as HttpServer } from "node:http";
import { Server as SocketServer } from "socket.io";
import { verifyAccessToken } from "../lib/tokens.js";

let io: SocketServer | null = null;

export function initRealtime(httpServer: HttpServer, corsOrigin: string): SocketServer {
  io = new SocketServer(httpServer, {
    cors: { origin: corsOrigin, credentials: true },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error("unauthorized"));
    try {
      const payload = verifyAccessToken(token);
      socket.data.shopId = payload.shopId;
      socket.data.staffId = payload.sub;
      next();
    } catch {
      next(new Error("unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    const shopId = socket.data.shopId as string;
    socket.join(`shop:${shopId}`);
  });

  return io;
}

export function emitToShop(
  shopId: string,
  event: string,
  payload: unknown,
): void {
  io?.to(`shop:${shopId}`).emit(event, payload);
}
