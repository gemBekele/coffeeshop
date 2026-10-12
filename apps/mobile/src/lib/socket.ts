import { io, type Socket } from "socket.io-client";
import { API_URL } from "../config";

let socket: Socket | null = null;

export function connectSocket(token: string): Socket {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  socket = io(API_URL, {
    transports: ["websocket"],
    auth: { token },
  });
  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}
