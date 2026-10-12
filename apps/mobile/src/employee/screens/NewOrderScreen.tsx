import React, { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import {
  Badge,
  Btn,
  BtnRow,
  Card,
  Dropdown,
  Input,
  KeyValue,
  Loading,
  Screen,
  SectionTitle,
  Subtitle,
} from "../../ui/kit";
import { useApp } from "../../state/AppContext";
import type { Order, Product } from "../../api/client";

interface CartLine {
  product: Product;
  variantId?: string;
  quantity: number;
}

const ORDER_TYPES = [
  { label: "Dine in", value: "DINE_IN" as const },
  { label: "Takeaway", value: "TAKEAWAY" as const },
];

export function NewOrderScreen({ onDone }: { onDone: () => void }) {
  const { api } = useApp();
  const [products, setProducts] = useState<Product[] | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [type, setType] = useState<"DINE_IN" | "TAKEAWAY">("DINE_IN");
  const [table, setTable] = useState("");
  const [txnId, setTxnId] = useState("");
  const [created, setCreated] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.products().then(setProducts).catch(() => setProducts([]));
  }, [api]);

  const add = (product: Product, variantId?: string) => {
    setCart((prev) => {
      const existing = prev.find((l) => l.product.id === product.id && l.variantId === variantId);
      if (existing) {
        return prev.map((l) => (l === existing ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [...prev, { product, variantId, quantity: 1 }];
    });
  };

  const change = (i: number, delta: number) => {
    setCart((prev) =>
      prev.flatMap((l, idx) => {
        if (idx !== i) return [l];
        const q = l.quantity + delta;
        return q <= 0 ? [] : [{ ...l, quantity: q }];
      }),
    );
  };

  const unitPrice = (line: CartLine) => {
    const variant = line.product.variants.find((v) => v.id === line.variantId);
    return line.product.price + (variant?.priceDelta ?? 0);
  };

  const total = cart.reduce((sum, l) => sum + unitPrice(l) * l.quantity, 0);

  const submit = async () => {
    setError(null);
    if (cart.length === 0) return setError("Add at least one item");
    try {
      const order = await api.createOrder({
        type,
        tableLabel: table || undefined,
        customerTxnId: txnId || undefined,
        items: cart.map((l) => ({
          productId: l.product.id,
          variantId: l.variantId,
          quantity: l.quantity,
        })),
      });
      setCreated(order);
      setCart([]);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  if (created) {
    return (
      <Screen
        title="Order created"
        onBack={onDone}
        footer={
          <>
            <Btn
              label="Paid in cash"
              onPress={async () => {
                await api.payCash(created.id).catch(() => {});
                onDone();
              }}
            />
            <Btn label="New order" variant="outline" onPress={() => setCreated(null)} />
          </>
        }
      >
        <Card tone="invert">
          <Text style={{ fontSize: 40, fontWeight: "900", color: "#FFFFFF" }}>
            #{created.orderNumber}
          </Text>
          <Text style={{ fontSize: 20, color: "#FFFFFF" }}>
            Total {created.total.toFixed(2)}
          </Text>
        </Card>
        <Badge label={created.status} tone="invert" />
      </Screen>
    );
  }

  return (
    <Screen
      title="New order"
      footer={
        <>
          {error ? <Subtitle>{error}</Subtitle> : null}
          <Btn label={`Create order · ${total.toFixed(2)}`} onPress={submit} />
        </>
      }
    >
      <Dropdown
        label="Order type"
        title="Choose order type"
        options={ORDER_TYPES}
        value={type}
        onChange={setType}
      />
      {type === "DINE_IN" ? (
        <Input label="Table" value={table} onChangeText={setTable} placeholder="T3" />
      ) : null}
      <Input
        label="Customer txn ID (optional)"
        value={txnId}
        onChangeText={setTxnId}
        placeholder="TB123456"
      />

      <SectionTitle>Choose a drink</SectionTitle>
      {products === null ? (
        <Loading />
      ) : (
        products.map((p) => (
          <Card key={p.id}>
            <Pressable onPress={() => add(p)}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ fontSize: 20, fontWeight: "800", color: "#000000" }}>
                  {p.name}
                </Text>
                <Text style={{ fontSize: 20, fontWeight: "800", color: "#000000" }}>
                  {p.price.toFixed(2)}
                </Text>
              </View>
            </Pressable>
            {p.variants.length > 0 ? (
              <View style={{ gap: 8 }}>
                {p.variants.map((v) => (
                  <Btn
                    key={v.id}
                    label={`${v.name} · ${(p.price + v.priceDelta).toFixed(2)}`}
                    variant="outline"
                    size="sm"
                    onPress={() => add(p, v.id)}
                  />
                ))}
              </View>
            ) : null}
          </Card>
        ))
      )}

      {cart.length > 0 ? (
        <Card>
          <SectionTitle>Current order</SectionTitle>
          {cart.map((l, i) => (
            <View key={`${l.product.id}-${l.variantId ?? "d"}`} style={{ gap: 8 }}>
              <KeyValue
                label={l.product.name}
                value={`${l.quantity} × ${unitPrice(l).toFixed(2)}`}
              />
              <BtnRow>
                <Btn label="−" variant="outline" size="sm" onPress={() => change(i, -1)} />
                <Btn label="+" variant="outline" size="sm" onPress={() => change(i, 1)} />
              </BtnRow>
            </View>
          ))}
          <KeyValue label="Total" value={total.toFixed(2)} />
        </Card>
      ) : null}
    </Screen>
  );
}