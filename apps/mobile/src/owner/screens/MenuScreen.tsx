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
import type { Category, Product } from "../../api/client";

export function MenuScreen() {
  const { api } = useApp();
  const [products, setProducts] = useState<Product[] | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api.products().then(setProducts).catch(() => setProducts([]));
    api.categories().then(setCategories).catch(() => setCategories([]));
  }, [api]);

  useEffect(load, [load]);

  const create = async () => {
    setError(null);
    const numeric = Number(price);
    if (!name.trim() || !Number.isFinite(numeric)) {
      setError("Add a name and a price");
      return;
    }
    try {
      await api.createProduct({
        name: name.trim(),
        price: numeric,
        categoryId: category,
      });
      setName("");
      setPrice("");
      setAdding(false);
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <Screen
      title="Menu"
      footer={
        adding ? (
          <Btn label="Cancel" variant="outline" onPress={() => setAdding(false)} />
        ) : (
          <Btn label="Add product" onPress={() => setAdding(true)} />
        )
      }
    >
      {adding ? (
        <Card>
          <SectionTitle>New product</SectionTitle>
          <Input label="Name" value={name} onChangeText={setName} placeholder="Cappuccino" autoCapitalize="words" />
          <Dropdown
            label="Category"
            title="Choose category"
            options={
              categories.length > 0
                ? categories.map((c) => ({ label: c.name, value: c.id }))
                : [{ label: "No categories yet", value: "none" }]
            }
            value={category}
            onChange={(v) => setCategory(v === "none" ? null : v)}
          />
          <SectionTitle>Price</SectionTitle>
          <View style={numStyles.display}>
            <Text style={numStyles.value}>{price || "0"}</Text>
          </View>
          <NumberPad
            value={price}
            onChange={setPrice}
            allowDecimal
            maxLength={9}
            leftKey={{ label: "C", onPress: () => setPrice("") }}
          />
          {error ? <Subtitle>{error}</Subtitle> : null}
          <Btn label="Save product" onPress={create} />
        </Card>
      ) : null}

      {products === null ? (
        <Loading />
      ) : products.length === 0 ? (
        <Empty text="No products yet." />
      ) : (
        products.map((p) => (
          <Card key={p.id}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 20, fontWeight: "800", color: "#000000", flex: 1 }}>
                {p.name}
              </Text>
              <Text style={{ fontSize: 20, fontWeight: "800", color: "#000000" }}>
                {p.price.toFixed(2)}
              </Text>
            </View>
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              <Badge label={p.isActive ? "active" : "hidden"} tone={p.isActive ? "invert" : "muted"} />
              {p.variants.length > 0 ? (
                <Badge label={`${p.variants.length} sizes`} tone="outline" />
              ) : null}
              {p.recipeIngredients.length > 0 ? (
                <Badge label={`${p.recipeIngredients.length} ingredients`} tone="outline" />
              ) : null}
            </View>
          </Card>
        ))
      )}
    </Screen>
  );
}

const numStyles = {
  display: {
    borderWidth: 2,
    borderColor: "#000000",
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center" as const,
  },
  value: { fontSize: 34, fontWeight: "900" as const, color: "#000000" },
};