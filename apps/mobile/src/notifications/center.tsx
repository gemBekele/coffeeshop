import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState, Pressable, StyleSheet, Text, View } from "react-native";
import { useApp } from "../state/AppContext";
import { onSocketEvent } from "../lib/socket";
import { goTo, onNavigate } from "../lib/nav";
import { colors, radius } from "../ui/theme";
import type { Payment } from "../api/client";
import {
  consumedLaunchNotification,
  enableNotifications,
  getPermissionState,
  notifyPayment,
  onNotificationTap,
  type PermissionState,
} from "./local";

interface NotificationsValue {
  unread: number;
  permission: PermissionState;
  markRead: () => void;
  enable: () => Promise<PermissionState>;
}

const NotificationsContext = createContext<NotificationsValue | null>(null);

const isBankPayment = (p: Payment) =>
  (p.source ?? "SMS") !== "MANUAL" &&
  (p.bank ?? "").toUpperCase() !== "CASH";

const money = (n: number) =>
  `ETB ${n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

/**
 * App-level notifications: an in-app banner while the app is open, a local
 * system notification while it is in the background, and an unread count for
 * the Payments tab. Uses the same socket events as the live lists.
 */
export function NotificationsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { session } = useApp();
  const [unread, setUnread] = useState(0);
  const [banner, setBanner] = useState<Payment | null>(null);
  const [permission, setPermission] = useState<PermissionState>("unknown");
  const seen = useRef(new Set<string>());
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const markRead = useCallback(() => setUnread(0), []);

  const enable = useCallback(async () => {
    const state = await enableNotifications();
    setPermission(state);
    return state;
  }, []);

  // Ask once after login (Android 13+ shows the system prompt here).
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    (async () => {
      const state = await getPermissionState();
      if (cancelled) return;
      if (state === "unknown") {
        const next = await enable();
        if (!cancelled) setPermission(next);
      } else {
        setPermission(state);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session, enable]);

  // New payments: banner in the foreground, system notification in the
  // background. Updates to an already-seen payment stay silent.
  useEffect(() => {
    if (!session) return;
    const off = onSocketEvent("payment:received", (payload) => {
      const payment = payload as Payment | undefined;
      if (!payment?.id || !isBankPayment(payment)) return;
      if (seen.current.has(payment.id)) return;
      seen.current.add(payment.id);
      if (seen.current.size > 500) {
        seen.current = new Set([...seen.current].slice(-200));
      }

      setUnread((n) => n + 1);

      if (AppState.currentState === "active") {
        setBanner(payment);
        if (hideTimer.current) clearTimeout(hideTimer.current);
        hideTimer.current = setTimeout(() => setBanner(null), 4500);
      } else {
        void notifyPayment({
          amount: payment.amount,
          sender: payment.sender ?? payment.bank,
          txnId: payment.txnId,
        });
      }
    });
    return off;
  }, [session]);

  // Tapping a notification (or launching from one) opens Payments.
  useEffect(() => {
    const offTap = onNotificationTap(() => {
      markRead();
      goTo("payments");
    });
    void consumedLaunchNotification().then((launched) => {
      if (launched) goTo("payments");
    });
    return offTap;
  }, [markRead]);

  const openBanner = useCallback(() => {
    setBanner(null);
    markRead();
    goTo("payments");
  }, [markRead]);

  return (
    <NotificationsContext.Provider
      value={{ unread, permission, markRead, enable }}
    >
      <View style={styles.root}>
        {children}
        {banner ? (
          <Pressable
            onPress={openBanner}
            accessibilityRole="button"
            accessibilityLabel="Open payments"
            style={({ pressed }) => [styles.banner, pressed && { opacity: 0.92 }]}
          >
            <View style={styles.bannerIcon}>
              <Text style={styles.bannerIconText}>↓</Text>
            </View>
            <View style={{ flex: 1, gap: 1 }}>
              <Text style={styles.bannerTitle}>Payment received</Text>
              <Text style={styles.bannerBody} numberOfLines={1}>
                {money(banner.amount)}
                {banner.sender ? ` · ${banner.sender}` : ""}
                {banner.txnId ? ` · Ref ${banner.txnId}` : ""}
              </Text>
            </View>
            <Text style={styles.bannerAction}>Open</Text>
          </Pressable>
        ) : null}
      </View>
    </NotificationsContext.Provider>
  );
}

export function useNotifications(): NotificationsValue {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotifications must be used within provider");
  return ctx;
}

/** Re-exported so shells can navigate on notification taps. */
export { goTo, onNavigate };

const styles = StyleSheet.create({
  root: { flex: 1 },
  banner: {
    position: "absolute",
    top: 8,
    left: 16,
    right: 16,
    backgroundColor: colors.brand,
    borderRadius: radius.control,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    shadowColor: "#0F172A",
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  bannerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  bannerIconText: {
    color: colors.onInverse,
    fontSize: 18,
    fontWeight: "800",
  },
  bannerTitle: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  bannerBody: {
    color: colors.onInverse,
    fontSize: 15,
    fontWeight: "700",
  },
  bannerAction: {
    color: colors.onInverse,
    fontSize: 13,
    fontWeight: "700",
  },
});
