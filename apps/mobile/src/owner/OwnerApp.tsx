import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { OwnerHomeScreen } from "./screens/OwnerHomeScreen";
import { TemplatesScreen } from "./screens/TemplatesScreen";
import { TemplateEditorScreen } from "./screens/TemplateEditorScreen";
import { PickSmsScreen } from "./screens/PickSmsScreen";
import { InboxScreen } from "./screens/InboxScreen";
import { MenuScreen } from "./screens/MenuScreen";
import { InventoryScreen } from "./screens/InventoryScreen";
import { StaffScreen } from "./screens/StaffScreen";
import { ReportsScreen } from "./screens/ReportsScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { SettingsHomeScreen } from "./screens/SettingsHomeScreen";
import { DayCloseScreen } from "./screens/DayCloseScreen";
import { TallyScreen } from "../screens/TallyScreen";
import { PaymentsScreen } from "../employee/screens/PaymentsScreen";
import { VerifyScreen } from "../employee/screens/VerifyScreen";
import { colors, PillTabBar } from "../ui/kit";
import type { NavIconName } from "../ui/icons";
import { useApp } from "../state/AppContext";

type Tab = "home" | "sell" | "menu" | "more";
type Sub =
  | null
  | { name: "templates" }
  | { name: "templateEditor"; id?: string; sample?: string }
  | { name: "pickSms"; returnTo?: { name: "templateEditor"; id?: string } }
  | { name: "inbox" }
  | { name: "stock" }
  | { name: "staff" }
  | { name: "reports" }
  | { name: "verify" }
  | { name: "settings" }
  | { name: "dayClose" }
  | { name: "payments" };

const TABS: Array<{ key: Tab; label: string; icon: NavIconName }> = [
  { key: "home", label: "Home", icon: "home" },
  { key: "sell", label: "Sell", icon: "cup" },
  { key: "menu", label: "Menu", icon: "menu" },
  { key: "more", label: "Settings", icon: "settings" },
];

export function OwnerApp() {
  const { signOut } = useApp();
  const [tab, setTab] = useState<Tab>("home");
  const [sub, setSub] = useState<Sub>(null);
  // Prewarm the other tabs after the first paint: instant switching without
  // paying for every screen during startup.
  const [warm, setWarm] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setWarm(true), 1200);
    return () => clearTimeout(timer);
  }, []);

  const goTab = (next: Tab) => {
    setSub(null);
    setTab(next);
  };

  let content: React.ReactNode;

  if (sub?.name === "templates") {
    content = (
      <TemplatesScreen
        onBack={() => setSub(null)}
        onEdit={(id) => setSub({ name: "templateEditor", id })}
        onCreate={(sample) =>
          sample
            ? setSub({ name: "templateEditor", sample })
            : setSub({ name: "pickSms" })
        }
      />
    );
  } else if (sub?.name === "templateEditor") {
    content = (
      <TemplateEditorScreen
        key={`${sub.id ?? "new"}-${sub.sample ? sub.sample.length : 0}`}
        templateId={sub.id}
        initialSample={sub.sample}
        onPickSms={() =>
          setSub({
            name: "pickSms",
            returnTo: { name: "templateEditor", id: sub.id },
          })
        }
        onDone={() => setSub(null)}
      />
    );
  } else if (sub?.name === "pickSms") {
    content = (
      <PickSmsScreen
        onBack={() => setSub(sub.returnTo ?? null)}
        onPick={(body) =>
          setSub({
            name: "templateEditor",
            id: sub.returnTo?.id,
            sample: body,
          })
        }
      />
    );
  } else if (sub?.name === "inbox") {
    content = (
      <InboxScreen
        onBack={() => setSub(null)}
        onUseSms={(sample) => setSub({ name: "templateEditor", sample })}
        onPickPhoneSms={() => setSub({ name: "pickSms" })}
        onReviewTemplate={(id) => setSub({ name: "templateEditor", id })}
      />
    );
  } else if (sub?.name === "payments") {
    content = (
      <PaymentsScreen
        onBack={() => setSub(null)}
        onScan={() => setSub({ name: "verify" })}
      />
    );
  } else if (sub?.name === "verify") {
    content = <VerifyScreen />;
  } else if (sub?.name === "settings") {
    content = <SettingsScreen onBack={() => setSub(null)} />;
  } else if (sub?.name === "dayClose") {
    content = (
      <DayCloseScreen
        onBack={() => setSub(null)}
        onOpenPending={() => setSub({ name: "inbox" })}
      />
    );
  } else if (sub?.name === "staff") {
    content = <StaffScreen onBack={() => setSub(null)} />;
  } else if (sub?.name === "reports") {
    content = <ReportsScreen onBack={() => setSub(null)} />;
  } else if (sub?.name === "stock") {
    content = <InventoryScreen onBack={() => setSub(null)} />;
  } else {
    // Main tabs stay mounted: switching is instant and data stays warm.
    content = (
      <>
        <View style={[styles.tabPane, tab !== "home" && styles.hidden]}>
          <OwnerHomeScreen
            onDayClose={() => setSub({ name: "dayClose" })}
            onStaff={() => setSub({ name: "staff" })}
            onSeeAllPayments={() => setSub({ name: "payments" })}
            onOpenInbox={() => setSub({ name: "inbox" })}
          />
        </View>
        {warm || tab === "sell" ? (
          <View style={[styles.tabPane, tab !== "sell" && styles.hidden]}>
            <TallyScreen onVerify={() => setSub({ name: "verify" })} />
          </View>
        ) : null}
        {warm || tab === "menu" ? (
          <View style={[styles.tabPane, tab !== "menu" && styles.hidden]}>
            <MenuScreen onOpenStock={() => setSub({ name: "stock" })} />
          </View>
        ) : null}
        {warm || tab === "more" ? (
          <View style={[styles.tabPane, tab !== "more" && styles.hidden]}>
            <SettingsHomeScreen
              onDayClose={() => setSub({ name: "dayClose" })}
              onTemplates={() => setSub({ name: "templates" })}
              onPaymentLimit={() => setSub({ name: "settings" })}
              onInbox={() => setSub({ name: "inbox" })}
              onStaff={() => setSub({ name: "staff" })}
              onStock={() => setSub({ name: "stock" })}
              onReports={() => setSub({ name: "reports" })}
              onSignOut={signOut}
            />
          </View>
        ) : null}
      </>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>{content}</View>
      <PillTabBar tabs={TABS} active={tab} onSelect={goTab} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { flex: 1 },
  tabPane: { flex: 1 },
  hidden: { display: "none" },
});
