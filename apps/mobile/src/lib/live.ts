import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { onSocketEvent, onSync } from "./socket";

const LIVE_EVENTS = [
  "payment:received",
  "sms:unmatched",
  "order:updated",
  "scan:matched",
  "pairing:approved",
];

/**
 * Keeps a screen's data live with three layers of protection:
 *  1. socket events (instant),
 *  2. a refetch whenever the socket reconnects or the app foregrounds,
 *  3. a light periodic fallback while visible.
 * This guarantees both phones show the same data even if one misses an event.
 */
export function useLive(load: () => void, intervalMs = 20000): void {
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    loadRef.current();

    // Coalesce bursts (an ingest can emit several events at once).
    let pending: ReturnType<typeof setTimeout> | null = null;
    const refresh = () => {
      if (pending) return;
      pending = setTimeout(() => {
        pending = null;
        loadRef.current();
      }, 250);
    };

    const unsubscribers = LIVE_EVENTS.map((event) =>
      onSocketEvent(event, refresh),
    );
    const unsubscribeSync = onSync(refresh);

    const timer = setInterval(() => {
      if (AppState.currentState === "active") loadRef.current();
    }, intervalMs);

    return () => {
      unsubscribers.forEach((off) => off());
      unsubscribeSync();
      if (pending) clearTimeout(pending);
      clearInterval(timer);
    };
  }, [intervalMs]);
}
