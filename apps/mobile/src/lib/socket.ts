import { AppState } from "react-native";
import { io, type Socket } from "socket.io-client";
import { API_URL } from "../config";

let socket: Socket | null = null;
let tokenGetter: (() => string | null) | null = null;

type Listener = () => void;
type EventHandler = (payload?: unknown) => void;
const syncListeners = new Set<Listener>();
const eventHandlers = new Map<string, Set<EventHandler>>();

/**
 * Screens subscribe to this to refetch. It fires when the socket (re)connects
 * and when the app returns to the foreground, which keeps every phone in sync
 * even after a network blip or a token rotation.
 */
export function onSync(fn: Listener): () => void {
  syncListeners.add(fn);
  return () => {
    syncListeners.delete(fn);
  };
}

function fireSync(): void {
  syncListeners.forEach((fn) => {
    try {
      fn();
    } catch {}
  });
}

/** The API layer calls this so reconnects always present the latest token. */
export function setSocketTokenGetter(fn: () => string | null): void {
  tokenGetter = fn;
}

/**
 * Persistent event subscription: handlers survive socket re-creation, so
 * screens mounted before the socket connects still receive live events.
 */
export function onSocketEvent(event: string, handler: EventHandler): () => void {
  let set = eventHandlers.get(event);
  if (!set) {
    set = new Set();
    eventHandlers.set(event, set);
  }
  set.add(handler);
  socket?.on(event, handler);
  return () => {
    set?.delete(handler);
    socket?.off(event, handler);
  };
}

export function connectSocket(): Socket {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  const auth = { token: tokenGetter?.() ?? "" };
  socket = io(API_URL, {
    // Start with HTTP long-polling and upgrade to WebSocket: some networks and
    // proxies block raw WebSocket, which silently starves the app of events.
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 500,
    reconnectionDelayMax: 4000,
    auth,
  });
  // socket.io reuses the initial `auth` object on reconnect; refresh it with
  // the current access token before every attempt (tokens rotate every 15m).
  socket.io.on("reconnect_attempt", () => {
    if (socket) socket.auth = { token: tokenGetter?.() ?? "" };
  });
  socket.on("connect", fireSync);
  socket.on("resync", fireSync);
  // Re-attach every screen's listeners to the new socket instance.
  for (const [event, handlers] of eventHandlers) {
    handlers.forEach((handler) => socket!.on(event, handler));
  }
  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}

// Foreground/background handling: reconnect and resync when the app wakes up.
AppState.addEventListener("change", (state) => {
  if (state !== "active") return;
  if (socket && !socket.connected) socket.connect();
  fireSync();
});
