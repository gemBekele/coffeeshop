import React, { useCallback, useEffect, useState } from "react";
import { View } from "react-native";
import {
  Btn,
  BtnRow,
  Card,
  Empty,
  Input,
  ListRowCard,
  Loading,
  Screen,
  Subtitle,
} from "../../ui/kit";
import { useApp } from "../../state/AppContext";
import type { InventoryItem } from "../../api/client";

export function InventoryScreen({ onBack }: { onBack: () => void }) {
  const { api } = useApp();
  const [items, setItems] = useState<InventoryItem[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUnit, setNewUnit] = useState("kg");
  const [newQty, setNewQty] = useState("");
  const [selected, setSelected] = useState<InventoryItem | null>(null);
  const [qty, setQty] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api.inventoryItems().then(setItems).catch(() => setItems([]));
  }, [api]);

  useEffect(load, [load]);

  const createItem = async () => {
    if (!newName.trim()) return setError("Enter an item name");
    try {
      await api.createInventoryItem({
        name: newName.trim(),
        unit: newUnit.trim() || "pcs",
        stockOnHand: Number(newQty) || 0,
      });
      setNewName("");
      setNewQty("");
      setAdding(false);
      setError(null);
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const move = async (type: "IN" | "OUT") => {
    if (!selected) return;
    const n = Number(qty);
    if (!Number.isFinite(n) || n <= 0) return setError("Enter a quantity");
    try {
      await api.stockMovement(selected.id, { type, quantity: n });
      setQty("");
      setSelected(null);
      setError(null);
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <Screen
      title="Stock"
      onBack={onBack}
      footer={
        adding ? (
          <Btn label="Cancel" variant="outline" onPress={() => setAdding(false)} />
        ) : (
          <Btn label="+ Add stock item" onPress={() => setAdding(true)} />
        )
      }
    >
      {adding ? (
        <Card>
          <Input
            label="Item name"
            value={newName}
            onChangeText={setNewName}
            placeholder="Coffee beans"
            autoCapitalize="words"
          />
          <Input
            label="Unit (kg, l, pcs)"
            value={newUnit}
            onChangeText={setNewUnit}
            placeholder="kg"
          />
          <Input
            label="Opening quantity"
            value={newQty}
            onChangeText={setNewQty}
            placeholder="10"
            keyboardType="numeric"
          />
          {error ? <Subtitle>{error}</Subtitle> : null}
          <Btn label="Save item" onPress={createItem} />
        </Card>
      ) : null}

      {selected ? (
        <Card>
          <Subtitle>Adjust {selected.name} ({selected.unit})</Subtitle>
          <Input
            value={qty}
            onChangeText={setQty}
            placeholder="Quantity"
            keyboardType="numeric"
          />
          {error ? <Subtitle>{error}</Subtitle> : null}
          <BtnRow>
            <View style={{ flex: 1 }}>
              <Btn label="− Stock out" variant="outline" onPress={() => move("OUT")} />
            </View>
            <View style={{ flex: 1 }}>
              <Btn label="+ Stock in" onPress={() => move("IN")} />
            </View>
          </BtnRow>
        </Card>
      ) : null}

      {items === null ? (
        <Loading />
      ) : items.length === 0 ? (
        <Empty text="No inventory items yet." />
      ) : (
        <View style={{ gap: 10 }}>
          {items.map((item) => (
            <ListRowCard
              key={item.id}
              icon={item.lowStock ? "!" : "▪"}
              highlight={item.lowStock}
              title={item.name}
              subtitle={item.lowStock ? "Running low · tap to restock" : "Tap to adjust"}
              rightTop={`${item.stockOnHand} ${item.unit}`}
              rightBottom={item.lowStock ? "Low" : "In stock"}
              onPress={() => {
                setSelected(item);
                setQty("");
              }}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}
