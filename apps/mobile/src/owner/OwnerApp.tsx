import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { OwnerHomeScreen } from "./screens/OwnerHomeScreen";
import { TemplatesScreen } from "./screens/TemplatesScreen";
import { TemplateEditorScreen } from "./screens/TemplateEditorScreen";
import { PickSmsScreen } from "./screens/PickSmsScreen";
import { InboxScreen } from "./screens/InboxScreen";
import { MenuScreen } from "./screens/MenuScreen";
import { InventoryScreen } from "./screens/InventoryScreen";
import { StaffScreen } from "./screens/StaffScreen";
import { ReportsScreen } from "./screens/ReportsScreen";
import { ScanPairingScreen } from "./screens/ScanPairingScreen";

type Tab = "home" | "templates" | "inbox" | "menu" | "stock" | "more";
type Sub =
  | null
  | { name: "templateEditor"; id?: string; sample?: string }
  | { name: "pickSms"; returnTo: { name: "templateEditor"; id?: string } }
  | { name: "staff" }
  | { name: "reports" }
  | { name: "scanPairing" };

const TABS: Array<{ key: Tab; label: string }> = [
  { key: "home", label: "Home" },
  { key: "templates", label: "Templates" },
  { key: "inbox", label: "Inbox" },
  { key: "menu", label: "Menu" },
  { key: "stock", label: "Stock" },
  { key: "more", label: "More" },
];

export function OwnerApp() {
  const [tab, setTab] = useState<Tab>("home");
  const [sub, setSub] = useState<Sub>(null);

  const goTab = (next: Tab) => {
    setSub(null);
    setTab(next);
  };

  let content: React.ReactNode;

  if (sub?.name === "templateEditor") {
    content = (
      <TemplateEditorScreen
        key={`${sub.id ?? "new"}-${sub.sample ? sub.sample.length : 0}`}
        templateId={sub.id}
        initialSample={sub.sample}
        onPickSms={() =>
          setSub({ name: "pickSms", returnTo: { name: "templateEditor", id: sub.id } })
        }
        onDone={() => setSub(null)}
      />
    );
  } else if (sub?.name === "pickSms") {
    content = (
      <PickSmsScreen
        onBack={() => setSub(sub.returnTo)}
        onPick={(body) =>
          setSub({ name: "templateEditor", id: sub.returnTo.id, sample: body })
        }
      />
    );
  } else if (sub?.name === "scanPairing") {
    content = <ScanPairingScreen onBack={() => setSub(null)} />;
  } else if (sub?.name === "staff") {
    content = <StaffScreen onBack={() => setSub(null)} />;
  } else if (sub?.name === "reports") {
    content = <ReportsScreen onBack={() => setSub(null)} />;
  } else {
    switch (tab) {
      case "templates":
        content = (
          <TemplatesScreen
            onEdit={(id) => setSub({ name: "templateEditor", id })}
            onCreate={(sample) => setSub({ name: "templateEditor", sample })}
          />
        );
        break;
      case "inbox":
        content = (
          <InboxScreen
            onUseSms={(sample) => setSub({ name: "templateEditor", sample })}
          />
        );
        break;
      case "menu":
        content = <MenuScreen />;
        break;
      case "stock":
        content = <InventoryScreen />;
        break;
      case "more":
        content = (
          <MoreScreen
            onStaff={() => setSub({ name: "staff" })}
            onReports={() => setSub({ name: "reports" })}
            onScan={() => setSub({ name: "scanPairing" })}
          />
        );
        break;
      default:
        content = <OwnerHomeScreen onOpenTemplates={() => goTab("templates")} />;
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>{content}</View>
      <View style={styles.tabbar}>
        {TABS.map((t) => (
          <Pressable
            key={t.key}
            style={styles.tab}
            onPress={() => goTab(t.key)}
          >
            <Text
              style={[
                styles.tabLabel,
                tab === t.key && !sub ? styles.tabActive : null,
              ]}
            >
              {t.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function MoreScreen({
  onStaff,
  onReports,
  onScan,
}: {
  onStaff: () => void;
  onReports: () => void;
  onScan: () => void;
}) {
  return (
    <View style={{ flex: 1, padding: 16, gap: 12, paddingTop: 64 }}>
      <Text style={styles.h1}>More</Text>
      <Pressable style={styles.moreItem} onPress={onScan}>
        <Text style={styles.moreText}>Scan employee QR</Text>
      </Pressable>
      <Pressable style={styles.moreItem} onPress={onStaff}>
        <Text style={styles.moreText}>Staff &amp; roles</Text>
      </Pressable>
      <Pressable style={styles.moreItem} onPress={onReports}>
        <Text style={styles.moreText}>Reports &amp; analytics</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  content: { flex: 1 },
  tabbar: {
    flexDirection: "row",
    borderTopWidth: 2,
    borderTopColor: "#000000",
    backgroundColor: "#FFFFFF",
    paddingBottom: 18,
    paddingTop: 10,
  },
  tab: { flex: 1, alignItems: "center", paddingVertical: 6 },
  tabLabel: { color: "#6B6B6B", fontSize: 12, fontWeight: "700" },
  tabActive: { color: "#000000", fontWeight: "900" },
  h1: { fontSize: 30, fontWeight: "900", color: "#000000" },
  moreItem: {
    borderWidth: 2,
    borderColor: "#000000",
    padding: 20,
    minHeight: 64,
    justifyContent: "center",
  },
  moreText: { fontSize: 20, fontWeight: "800", color: "#000000" },
});