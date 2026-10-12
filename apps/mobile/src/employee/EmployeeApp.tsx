import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BoardScreen } from "./screens/BoardScreen";
import { NewOrderScreen } from "./screens/NewOrderScreen";
import { PaymentsScreen } from "./screens/PaymentsScreen";

type Tab = "board" | "new" | "payments";

const TABS: Array<{ key: Tab; label: string }> = [
  { key: "board", label: "Orders" },
  { key: "new", label: "New" },
  { key: "payments", label: "Payments" },
];

export function EmployeeApp() {
  const [tab, setTab] = useState<Tab>("board");

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {tab === "board" ? (
          <BoardScreen onNewOrder={() => setTab("new")} />
        ) : tab === "new" ? (
          <NewOrderScreen onDone={() => setTab("board")} />
        ) : (
          <PaymentsScreen />
        )}
      </View>
      <View style={styles.tabbar}>
        {TABS.map((t) => (
          <Pressable key={t.key} style={styles.tab} onPress={() => setTab(t.key)}>
            <Text style={[styles.tabLabel, tab === t.key && styles.tabActive]}>
              {t.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  content: { flex: 1 },
  tabbar: {
    flexDirection: "row",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#000000",
    backgroundColor: "#FFFFFF",
    paddingBottom: 20,
    paddingTop: 8,
  },
  tab: { flex: 1, alignItems: "center" },
  tabLabel: { color: "#6B6B6B", fontSize: 13 },
  tabActive: { color: "#000000", fontWeight: "700" },
});
