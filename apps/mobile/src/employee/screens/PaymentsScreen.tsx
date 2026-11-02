import React, { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  colors,
  Empty,
  Fab,
  Loading,
  Screen,
  ScanIcon,
} from "../../ui/kit";
import { useApp } from "../../state/AppContext";
import { useLive } from "../../lib/live";
import type { Payment } from "../../api/client";

type Filter = "todo" | "done";

const money = (n: number) =>
  `ETB ${n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const timeOf = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

/**
 * Bank transfers. One row = payer, amount, reference and time. "Verify" marks
 * the transfer as received, which is what day close subtracts from sales.
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
  const [filter, setFilter] = useState<Filter>("todo");
  const [verifying, setVerifying] = useState<string | null>(null);
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
  }, [api]);

  useLive(load);

  const isSettled = (p: Payment) =>
    p.confirmed || p.status === "VERIFIED" || p.status === "MATCHED";

  const verify = async (p: Payment) => {
    if (verifying) return;
    setVerifying(p.id);
    setError(null);
    try {
      await api.confirmPayment(p.id);
      load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setVerifying(null);
    }
  };

  if (all === null) {
    return (
      <Screen title="Payments" onBack={onBack}>
        <Loading />
      </Screen>
    );
  }

  const todo = all.filter((p) => !isSettled(p));
  const done = all.filter(isSettled);
  const list = filter === "todo" ? todo : done;

  return (
    <Screen
      title="Payments"
      onBack={onBack}
      fab={
        onScan ? (
          <Fab
            icon={<ScanIcon size={26} />}
            accessibilityLabel="Scan a payment"
            onPress={onScan}
          />
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
              ? "Nothing waiting. New transfers appear here instantly."
              : "No verified transfers yet."
          }
        />
      ) : (
        <View style={{ gap: 10 }}>
          {list.map((p) => (
            <View key={p.id} style={styles.row}>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={styles.name} numberOfLines={1}>
                  {p.sender ?? p.bank ?? "Transfer"}
                </Text>
                <Text style={styles.ref} numberOfLines={1}>
                  Ref {p.txnId} · {timeOf(p.receivedAt)}
                </Text>
              </View>

              <View style={styles.right}>
                <Text style={styles.amount}>{money(p.amount)}</Text>
                {isSettled(p) ? (
                  <Text style={styles.status}>
                    {p.confirmed ? "Received" : "Verified"}
                  </Text>
                ) : (
                  <Pressable
                    onPress={() => void verify(p)}
                    disabled={verifying === p.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Verify ${money(p.amount)} from ${
                      p.sender ?? "transfer"
                    }`}
                    style={({ pressed }) => [
                      styles.verifyBtn,
                      pressed && { opacity: 0.75 },
                    ]}
                  >
                    <Text style={styles.verifyText}>
                      {verifying === p.id ? "…" : "Verify"}
                    </Text>
                  </Pressable>
                )}
              </View>
            </View>
          ))}
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
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  name: { fontSize: 16, fontWeight: "700", color: colors.text },
  ref: { fontSize: 13, color: colors.textMuted },
  right: { alignItems: "flex-end", gap: 6 },
  amount: { fontSize: 17, fontWeight: "800", color: colors.text },
  status: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.brand,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  verifyBtn: {
    backgroundColor: colors.brand,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  verifyText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.onInverse,
  },
});
