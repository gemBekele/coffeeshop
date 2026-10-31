import React, { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import {
  Btn,
  Card,
  Empty,
  Input,
  ListRowCard,
  Loading,
  Screen,
  Subtitle,
  colors,
} from "../../ui/kit";
import { useApp } from "../../state/AppContext";
import type { Product } from "../../api/client";

export function MenuScreen({ onOpenStock }: { onOpenStock?: () => void }) {
  const { api } = useApp();
  const [products, setProducts] = useState<Product[] | null>(null);
  const [mode, setMode] = useState<"list" | "add" | "edit">("list");
  const [editing, setEditing] = useState<Product | null>(null);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api.products().then(setProducts).catch(() => setProducts([]));
  }, [api]);

  useEffect(load, [load]);

  const reset = () => {
    setMode("list");
    setEditing(null);
    setName("");
    setPrice("");
    setError(null);
  };

  const startAdd = () => {
    reset();
    setMode("add");
  };

  const startEdit = (product: Product) => {
    setMode("edit");
    setEditing(product);
    setName(product.name);
    setPrice(String(product.price));
    setError(null);
  };

  const valid = () => {
    const numeric = Number(price);
    if (!name.trim() || !Number.isFinite(numeric) || numeric <= 0) {
      setError("Enter a name and a price");
      return null;
    }
    return { name: name.trim(), price: numeric };
  };

  const save = async () => {
    const input = valid();
    if (!input) return;
    setBusy(true);
    try {
      if (mode === "edit" && editing) {
        await api.updateProduct(editing.id, input);
      } else {
        await api.createProduct(input);
      }
      reset();
      load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = () => {
    if (!editing) return;
    Alert.alert(
      `Delete ${editing.name}?`,
      "It leaves the menu. Past sales are not affected.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await api.deleteProduct(editing.id);
              reset();
              load();
            } catch (err) {
              setError((err as Error).message);
            }
          },
        },
      ],
    );
  };

  return (
    <Screen
      title="Menu"
      right={
        onOpenStock ? (
          <Btn label="Stock" variant="outline" size="sm" onPress={onOpenStock} />
        ) : undefined
      }
      footer={
        mode === "list" ? (
          <Btn label="+ Add drink" onPress={startAdd} />
        ) : (
          <Btn label="Cancel" variant="outline" onPress={reset} />
        )
      }
    >
      {mode === "add" || mode === "edit" ? (
        <Card>
          <Text style={{ fontSize: 17, fontWeight: "800", color: colors.text }}>
            {mode === "edit" ? `Edit ${editing?.name ?? "drink"}` : "New drink"}
          </Text>
          <Input
            label="Name"
            value={name}
            onChangeText={setName}
            placeholder="Macchiato"
            autoCapitalize="words"
          />
          <Input
            label="Price (ETB)"
            value={price}
            onChangeText={setPrice}
            placeholder="80"
            keyboardType="numeric"
          />
          {error ? <Subtitle>{error}</Subtitle> : null}
          <Btn
            label={busy ? "Saving…" : "Save"}
            onPress={save}
            disabled={busy}
          />
          {mode === "edit" ? (
            <Btn label="Delete item" variant="ghost" onPress={remove} />
          ) : null}
        </Card>
      ) : null}

      {products === null ? (
        <Loading />
      ) : products.length === 0 ? (
        <Empty text="No drinks yet. Tap + Add drink to start your menu." />
      ) : (
        <View style={{ gap: 10 }}>
          {products.map((p) => (
            <ListRowCard
              key={p.id}
              icon="◈"
              title={p.name}
              subtitle={
                p.variants.length > 0
                  ? `${p.variants.length} sizes`
                  : "Standard"
              }
              rightTop={`ETB ${p.price.toFixed(2)}`}
              rightBottom="Tap to edit"
              onPress={() => startEdit(p)}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}
