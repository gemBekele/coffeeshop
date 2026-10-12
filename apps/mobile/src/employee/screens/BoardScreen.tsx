import React, { useCallback, useEffect, useState } from "react";
import { Text, View } from "react-native";
import {
  Badge,
  Btn,
  Card,
  Empty,
  Loading,
  Screen,
  Subtitle,
} from "../../ui/kit";
import { useApp } from "../../state/AppContext";
import { getSocket } from "../../lib/socket";
import type { Order } from "../../api/client";

const NEXT: Record<string, string | null> = {
  OPEN: "CONFIRMED",
  CONFIRMED: "PREPARING",
  PREPARING: "READY",
  READY: "SERVED",
  SERVED: "PAID",
  PAID: null,
  VOID: null,
};

const STEP_LABEL: Record<string, string> = {
  CONFIRMED: "Accept",
  PREPARING: "Start",
  READY: "Ready",
  SERVED: "Serve",
};

export function BoardScreen({ onNewOrder }: { onNewOrder: () => void }) {
  const { api } = useApp();
  const [orders, setOrders] = useState<Order[] | null>(null);

  const load = useCallback(() => {
    api
      .orderBoard()
      .then((board) => {
        const flat: Order[] = [];
        for (const key of ["OPEN", "CONFIRMED", "PREPARING", "READY", "SERVED"]) {
          for (const o of board[key] ?? []) flat.push(o);
        }
        setOrders(flat);
      })
      .catch(() => setOrders([]));
  }, [api]);

  useEffect(() => {
    load();
    const socket = getSocket();
    socket?.on("order:created", load);
    socket?.on("order:updated", load);
    return () => {
      socket?.off("order:created", load);
      socket?.off("order:updated", load);
    };
  }, [load]);

  const advance = async (order: Order) => {
    const next = NEXT[order.status];
    if (!next) return;
    await api.updateOrderStatus(order.id, next).catch(() => {});
    load();
  };

  const payCash = async (order: Order) => {
    await api.payCash(order.id).catch(() => {});
    load();
  };

  return (
    <Screen
      title="Orders"
      footer={<Btn label="New order" onPress={onNewOrder} />}
    >
      {orders === null ? (
        <Loading />
      ) : orders.length === 0 ? (
        <Empty text="No open orders." />
      ) : (
        orders.map((order) => {
          const next = NEXT[order.status];
          return (
            <Card key={order.id}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ fontSize: 24, fontWeight: "900", color: "#000000" }}>
                  #{order.orderNumber}
                </Text>
                <Text style={{ fontSize: 24, fontWeight: "900", color: "#000000" }}>
                  {order.total.toFixed(2)}
                </Text>
              </View>
              <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                <Badge label={order.status} tone="invert" />
                <Badge label={order.type === "DINE_IN" ? order.tableLabel ?? "table" : "takeaway"} tone="outline" />
              </View>
              <Subtitle>
                {order.items.map((i) => `${i.nameSnapshot} ×${i.quantity}`).join("  ·  ")}
              </Subtitle>
              {next ? (
                <Btn
                  label={STEP_LABEL[next] ? `${STEP_LABEL[next]} →` : next}
                  onPress={() => advance(order)}
                />
              ) : null}
              <Btn
                label="Paid in cash"
                variant="outline"
                size="md"
                onPress={() => payCash(order)}
              />
            </Card>
          );
        })
      )}
    </Screen>
  );
}