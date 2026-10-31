import React, { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  colors,
  Empty,
  Loading,
  ScanIcon,
  radius,
  Screen,
  Subtitle,
} from "../ui/kit";
import { useApp } from "../state/AppContext";
import { getSocket } from "../lib/socket";
import type { DailyReport, Product } from "../api/client";

export function TallyScreen({ onVerify }: { onVerify?: () => void }) {
  const { api, session } = useApp();
  const [products, setProducts] = useState<Product[] | null>(null);
  const [daily, setDaily] = useState<DailyReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const pending = useRef(0);

  const load = useCallback(async () => {
    try {
      const [prods, report] = await Promise.all([
        api.products(),
        api.dailyReport(),
      ]);
      setProducts(prods.filter((p) => p.isActive));
      setDaily(report);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [api]);

  useEffect(() => {
    void load();
    const socket = getSocket();
    socket?.on("order:updated", load);
    return () => {
      socket?.off("order:updated", load);
    };
  }, [load]);

  const countFor = useCallback(
    (productId: string) =>
      daily?.items.find((i) => i.productId === productId)?.quantity ?? 0,
    [daily],
  );

  const sell = useCallback(
    async (product: Product) => {
      setError(null);
      setBusyId(product.id);
      pending.current += 1;
      // Optimistic bump so the count feels instant.
      setDaily((prev) =>
        prev
          ? {
              ...prev,
              totalItems: prev.totalItems + 1,
              totalSales: prev.totalSales + product.price,
              orderCount: prev.orderCount + 1,
              items: prev.items.some((i) => i.productId === product.id)
                ? prev.items.map((i) =>
                    i.productId === product.id
                      ? {
                          ...i,
                          quantity: i.quantity + 1,
                          revenue: i.revenue + product.price,
                        }
                      : i,
                  )
                : [
                    ...prev.items,
                    {
                      productId: product.id,
                      name: product.name,
                      quantity: 1,
                      revenue: product.price,
                    },
                  ],
            }
          : prev,
      );
      try {
        await api.quickSale(product.id, 1);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        pending.current -= 1;
        setBusyId((current) => (current === product.id ? null : current));
        // Reconcile with the server once the last tap settles.
        if (pending.current === 0) {
          try {
            setDaily(await api.dailyReport());
          } catch {
            /* keep optimistic value */
          }
        }
      }
    },
    [api],
  );

  const currency = "ETB";
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "short",
  });

  return (
    <Screen scroll>
      <View style={styles.summary}>
        {onVerify ? (
          <Pressable
            onPress={onVerify}
            accessibilityRole="button"
            accessibilityLabel="Scan a payment"
            style={({ pressed }) => [styles.scanBtn, pressed && { opacity: 0.7 }]}
          >
            <ScanIcon size={22} />
          </Pressable>
        ) : null}
        <Text style={styles.summaryLabel}>{today}</Text>
        <Text style={styles.summaryAmount}>
          {currency}{" "}
          {(daily?.totalSales ?? 0).toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </Text>
        <Text style={styles.summarySub}>
          {daily?.totalItems ?? 0} sold ·{" "}
          {session?.staff.fullName?.split(" ")[0] ?? "today"}
        </Text>
      </View>

      {error ? <Subtitle>{error}</Subtitle> : null}

      {products === null ? (
        <Loading />
      ) : products.length === 0 ? (
        <Empty text="No menu items yet. Add drinks under Menu first." />
      ) : (
        <View style={{ gap: 10 }}>
          {(showAll ? products : products.slice(0, 6)).map((p) => {
            const count = countFor(p.id);
            const active = count > 0;
            return (
              <Pressable
                key={p.id}
                onPress={() => void sell(p)}
                disabled={busyId === p.id}
                style={({ pressed }) => [
                  styles.row,
                  active && styles.rowActive,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <View style={[styles.countCircle, active && styles.countCircleActive]}>
                  <Text style={[styles.countText, active && styles.countTextActive]}>
                    {count}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{p.name}</Text>
                  <Text style={styles.price}>
                    {currency} {p.price.toFixed(2)}
                  </Text>
                </View>
                <View style={styles.plusCircle}>
                  <Text style={styles.plusText}>+</Text>
                </View>
              </Pressable>
            );
          })}
          {products.length > 6 ? (
            <Pressable onPress={() => setShowAll((v) => !v)} style={styles.moreRow}>
              <Text style={styles.moreText}>
                {showAll ? "Show fewer" : `All ${products.length} drinks`}
              </Text>
            </Pressable>
          ) : null}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  scanBtn: {
    position: "absolute",
    top: 14,
    right: 14,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  summary: {
    backgroundColor: colors.brand,
    borderRadius: radius.card,
    padding: 24,
    alignItems: "center",
    gap: 4,
    marginTop: 8,
  },
  summaryLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(255,255,255,0.7)",
  },
  summaryAmount: {
    fontSize: 34,
    fontWeight: "800",
    color: colors.onInverse,
    letterSpacing: -0.6,
  },
  summarySub: {
    fontSize: 14,
    color: "rgba(255,255,255,0.75)",
  },
  moreRow: {
    alignItems: "center",
    paddingVertical: 12,
  },
  moreText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.brand,
  },
  row: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  rowActive: {
    borderWidth: 1.5,
    borderColor: colors.brand,
  },
  countCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  countCircleActive: {
    backgroundColor: colors.brand,
  },
  countText: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.textMuted,
  },
  countTextActive: {
    color: colors.onInverse,
  },
  name: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
  },
  price: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textMuted,
  },
  plusCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  plusText: {
    fontSize: 26,
    fontWeight: "700",
    color: colors.onInverse,
    marginTop: -2,
  },
});
