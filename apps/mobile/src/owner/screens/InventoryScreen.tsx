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
  NumberPad,
  Screen,
  SectionTitle,
  Subtitle,
} from "../../ui/kit";
import { useApp } from "../../state/AppContext";
import type { InventoryItem } from "../../api/client";

const UNITS = ["g", "kg", "ml", "l", "pcs", "pack", "bottle", "scoop"];

const MOVE_TYPES = [
  { label: "Stock in", value: "IN" },
  { label: "Stock out", value: "OUT" },
  { label: "Waste / spoiled", value: "WASTE" },
  { label: "Adjust (count)", value: "ADJUST" },
];

export function InventoryScreen() {
  const { api } = useApp();
  const [items, setItems] = useState<InventoryItem[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUnit, setNewUnit] = useState<string>("pcs");
  const [newQty, setNewQty] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [moveType, setMoveType] = useState<string>("IN");
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
        unit: newUnit,
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

  const recordMovement = async () => {
    if (!selected) return;
    const n = Number(qty);
    if (!Number.isFinite(n) || n === 0) return setError("Enter a quantity");
    try {
      await api.stockMovement(selected, { type: moveType, quantity: n });
      setQty("");
      setSelected(null);
      setError(null);
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const lowCount = (items ?? []).filter((i) => i.lowStock).length;

  return (
    <Screen
      title="Stock"
      footer={
        adding ? (
          <Btn label="Cancel" variant="outline" onPress={() => setAdding(false)} />
        ) : (
          <Btn label="Add item" onPress={() => setAdding(true)} />
        )
      }
    >
      {lowCount > 0 ? (
        <Card tone="invert">
          <Text style={{ fontSize: 18, fontWeight: "800", color: "#FFFFFF" }}>
            {lowCount} item{lowCount > 1 ? "s" : ""} running low
          </Text>
        </Card>
      ) : null}

      {adding ? (
        <Card>
          <SectionTitle>New item</SectionTitle>
          <Input
            label="Name"
            value={newName}
            onChangeText={setNewName}
            placeholder="Oat milk"
            autoCapitalize="words"
          />
          <Dropdown
            label="Unit"
            title="Choose unit"
            options={UNITS.map((u) => ({ label: u, value: u }))}
            value={newUnit}
            onChange={setNewUnit}
          />
          <SectionTitle>Opening quantity</SectionTitle>
          <View style={num.display}>
            <Text style={num.value}>{newQty || "0"}</Text>
          </View>
          <NumberPad
            value={newQty}
            onChange={setNewQty}
            allowDecimal
            maxLength={10}
            leftKey={{ label: "C", onPress: () => setNewQty("") }}
          />
          {error ? <Subtitle>{error}</Subtitle> : null}
          <Btn label="Save item" onPress={createItem} />
        </Card>
      ) : null}

      {selected ? (
        <Card>
          <SectionTitle>Record movement</SectionTitle>
          <Dropdown
            label="Type"
            title="Choose movement"
            options={MOVE_TYPES}
            value={moveType}
            onChange={setMoveType}
          />
          <View style={num.display}>
            <Text style={num.value}>{qty || "0"}</Text>
          </View>
          <NumberPad
            value={qty}
            onChange={setQty}
            allowDecimal
            maxLength={10}
            leftKey={{ label: "C", onPress: () => setQty("") }}
            rightKey={{
              label: "Save",
              onPress: recordMovement,
            }}
          />
          {error ? <Subtitle>{error}</Subtitle> : null}
          <Btn label="Done" variant="outline" onPress={() => setSelected(null)} />
        </Card>
      ) : null}

      {items === null ? (
        <Loading />
      ) : items.length === 0 ? (
        <Empty text="No inventory items." />
      ) : (
        items.map((item) => (
          <Card key={item.id}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Text style={{ fontSize: 20, fontWeight: "800", color: "#000000", flex: 1 }}>
                {item.name}
              </Text>
              <Text style={{ fontSize: 22, fontWeight: "900", color: "#000000" }}>
                {item.stockOnHand} {item.unit}
              </Text>
            </View>
            {item.lowStock ? <Badge label="low stock" tone="invert" /> : null}
            <Btn
              label="Adjust"
              variant="outline"
              size="md"
              onPress={() => {
                setSelected(item.id);
                setQty("");
                setMoveType("IN");
              }}
            />
          </Card>
        ))
      )}
    </Screen>
  );
}

const num = {
  display: {
    borderWidth: 2,
    borderColor: "#000000",
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center" as const,
  },
  value: { fontSize: 34, fontWeight: "900" as const, color: "#000000" },
};