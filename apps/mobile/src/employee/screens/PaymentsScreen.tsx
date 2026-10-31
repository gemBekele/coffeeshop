import React, { useCallback, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import {
  Btn,
  colors,
  Empty,
  ListRowCard,
  Loading,
  Screen,
} from "../../ui/kit";
import { useApp } from "../../state/AppContext";
import { useLive } from "../../lib/live";
import type { Order, Payment } from "../../api/client";

type Filter = "todo" | "done";

const money = (n: number) =>
  `ETB ${n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const timeOf = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

/**
 * One place for bank money on a phone: transfers waiting for an action and
 * settled ones. A single tap opens the one action that applies.
 */
export function PaymentsScreen({
  onBack,
  onScan,
}: {
  onBack?: () => void;
  onScan?: () => void;
}) {
  const { api } = useApp();
  const [all, setAll] = useState<Payment[] | null>(null);
  const [openOrders, setOpenOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<Filter>("todo");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api
      .payments()
      .then((r) =>
        setAll(
          r.items.filter(
            (p) =>
              (p.source ?? "SMS") !== "MANUAL" &&
              (p.bank ?? "").toUpperCase() !== "CASH",
          ),
        ),
      )
      .catch(() => setAll([]));
    api
      .orderBoard()
      .then((board) => {
        const flat: Order[] = [];
        for (const key of ["OPEN", "CONFIRMED", "PREPARING", "READY", "SERVED"]) {
          for (const order of board[key] ?? []) flat.push(order);
        }
        setOpenOrders(flat);
      })
      .catch(() => {});
  }, [api]);

  useLive(load);

  const isTodo = (p: Payment) =>
    p.confirmed === false || p.status === "UNMATCHED";

  const attach = async (p: Payment, order: Order) => {
    setError(null);
    try {
      await api.matchPayment(p.id, order.id);
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const confirmPickup = async (p: Payment) => {
    setError(null);
    try {
      await api.confirmPayment(p.id);
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const openActions = (p: Payment) => {
    if (p.status === "UNMATCHED") {
      const suggested =
        openOrders.find((o) => Math.abs(o.total - p.amount) < 0.01) ??
        openOrders[0];
      if (!suggested) {
        Alert.alert(money(p.amount), "No open order to attach this to.");
        return;
      }
      Alert.alert(money(p.amount), `Attach to order #${suggested.orderNumber}?`, [
        { text: "Later", style: "cancel" },
        { text: "Attach", onPress: () => void attach(p, suggested) },
      ]);
      return;
    }
    if (p.confirmed === false) {
      Alert.alert(money(p.amount), "Money was handed over for this transfer.", [
        { text: "Not yet", style: "cancel" },
        { text: "Confirm picked up", onPress: () => void confirmPickup(p) },
      ]);
      return;
    }
  };

  if (all === null) {
    return (
      <Screen title="Payments" onBack={onBack}>
        <Loading />
      </Screen>
    );
  }

  const todo = all.filter(isTodo);
  const done = all.filter((p) => !isTodo(p));
  const list = filter === "todo" ? todo : done;

  return (
    <Screen
      title="Payments"
      onBack={onBack}
      right={
        onScan ? (
          <Btn label="Scan" size="sm" variant="outline" onPress={onScan} />
        ) : undefined
      }
    >
      <View style={styles.chipRow}>
        {(
          [
            { key: "todo", label: `To verify (${todo.length})` },
            { key: "done", label: `Verified (${done.length})` },
          ] as Array<{ key: Filter; label: string }>
        ).map((chip) => {
          const active = filter === chip.key;
          return (
            <Pressable
              key={chip.key}
              onPress={() => setFilter(chip.key)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {chip.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {list.length === 0 ? (
        <Empty
          text={
            filter === "todo"
              ? "Nothing waiting. Transfers that need action show up here."
              : "No verified transfers yet."
          }
        />
      ) : (
        <View style={{ gap: 10 }}>
          {list.map((p) => {
            const needsConfirm = p.status !== "UNMATCHED" && p.confirmed === false;
            return (
              <ListRowCard
                key={p.id}
                icon={needsConfirm || p.status === "UNMATCHED" ? "!" : "✓"}
                highlight={needsConfirm || p.status === "UNMATCHED"}
                title={`${money(p.amount)} · ${p.sender ?? p.bank ?? "Transfer"}`}
                subtitle={`Ref ${p.txnId} · ${timeOf(p.receivedAt)}`}
                rightTop={
                  p.status === "UNMATCHED"
                    ? "Attach"
                    : needsConfirm
                      ? "Confirm"
                      : p.order
                        ? `#${p.order.orderNumber}`
                        : "Paid"
                }
                rightBottom={
                  p.status === "UNMATCHED"
                    ? "Open order"
                    : needsConfirm
                      ? "Picked up?"
                      : "Verified"
                }
                onPress={isTodo(p) ? () => openActions(p) : undefined}
              />
            );
          })}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chipRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.brand },
  chipText: { fontSize: 13, fontWeight: "600", color: colors.textMuted },
  chipTextActive: { color: colors.onInverse },
  error: { fontSize: 13, color: "#B45309" },
});
