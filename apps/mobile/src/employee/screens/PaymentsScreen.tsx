import React, { useCallback, useEffect, useState } from "react";
import { Text, View } from "react-native";
import {
  Badge,
  Btn,
  Card,
  Dropdown,
  Empty,
  Input,
  Loading,
  Screen,
  SectionTitle,
  Subtitle,
} from "../../ui/kit";
import { useApp } from "../../state/AppContext";
import { getSocket } from "../../lib/socket";
import type { Order, Payment, VerifyResult } from "../../api/client";

export function PaymentsScreen() {
  const { api } = useApp();
  const [unmatched, setUnmatched] = useState<Payment[] | null>(null);
  const [recent, setRecent] = useState<Payment[]>([]);
  const [openOrders, setOpenOrders] = useState<Order[]>([]);
  const [verifyTxn, setVerifyTxn] = useState("");
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const [selected, setSelected] = useState<Payment | null>(null);
  const [orderChoice, setOrderChoice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api.unmatchedPayments().then(setUnmatched).catch(() => setUnmatched([]));
    api.payments().then((r) => setRecent(r.items.slice(0, 10))).catch(() => {});
    api.orders().then((r) => setOpenOrders(r.items)).catch(() => {});
  }, [api]);

  useEffect(() => {
    load();
    const socket = getSocket();
    socket?.on("payment:received", load);
    socket?.on("order:updated", load);
    return () => {
      socket?.off("payment:received", load);
      socket?.off("order:updated", load);
    };
  }, [load]);

  const verify = async () => {
    setError(null);
    try {
      setVerifyResult(await api.verify(verifyTxn.trim()));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const match = async () => {
    if (!selected || !orderChoice) return;
    setError(null);
    try {
      await api.matchPayment(selected.id, orderChoice);
      setSelected(null);
      setOrderChoice(null);
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const orderOptions = openOrders.map((o) => ({
    label: `#${o.orderNumber} · ${o.total.toFixed(2)} · ${o.status}`,
    value: o.id,
  }));

  return (
    <Screen title="Payments">
      <Card>
        <SectionTitle>Verify a transaction</SectionTitle>
        <Input
          label="Transaction ID"
          value={verifyTxn}
          onChangeText={setVerifyTxn}
          placeholder="TB1234567890"
        />
        <Btn label="Verify" onPress={verify} variant="outline" />
        {verifyResult ? (
          <View style={{ gap: 6 }}>
            <Badge
              label={verifyResult.found ? "found" : "not found"}
              tone={verifyResult.found ? "invert" : "muted"}
            />
            {verifyResult.order ? (
              <Subtitle>
                Order #{verifyResult.order.orderNumber} · {verifyResult.order.status}
              </Subtitle>
            ) : null}
          </View>
        ) : null}
      </Card>

      {error ? <Subtitle>{error}</Subtitle> : null}

      <SectionTitle>Unmatched payments</SectionTitle>
      {unmatched === null ? (
        <Loading />
      ) : unmatched.length === 0 ? (
        <Empty text="No unmatched payments." />
      ) : (
        unmatched.map((p) => (
          <Card key={p.id}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 24, fontWeight: "900", color: "#000000" }}>
                {p.amount.toFixed(2)}
              </Text>
              <Badge label={p.bank ?? "—"} tone="outline" />
            </View>
            <Subtitle>
              {p.txnId} · {p.sender ?? "unknown"}
            </Subtitle>
            {selected?.id === p.id ? (
              <View style={{ gap: 10 }}>
                <Dropdown
                  label="Attach to order"
                  title="Choose an order"
                  options={
                    orderOptions.length > 0
                      ? orderOptions
                      : [{ label: "No open orders", value: "none" }]
                  }
                  value={orderChoice}
                  onChange={setOrderChoice}
                />
                <Btn label="Attach payment" onPress={match} />
                <Btn label="Cancel" variant="outline" onPress={() => setSelected(null)} />
              </View>
            ) : (
              <Btn
                label="Attach to an order…"
                variant="outline"
                onPress={() => setSelected(p)}
              />
            )}
          </Card>
        ))
      )}

      <SectionTitle>Recent</SectionTitle>
      {recent.length === 0 ? (
        <Empty text="No payments yet." />
      ) : (
        recent.map((p) => (
          <Card key={p.id} tone="muted">
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 18, fontWeight: "800", color: "#000000" }}>
                {p.amount.toFixed(2)}
              </Text>
              <Badge
                label={p.status}
                tone={p.status === "VERIFIED" ? "invert" : "muted"}
              />
            </View>
            <Text style={{ color: "#6B6B6B", fontSize: 14 }}>{p.txnId}</Text>
          </Card>
        ))
      )}
    </Screen>
  );
}