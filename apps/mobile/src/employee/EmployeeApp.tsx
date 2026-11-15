import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { PaymentsScreen } from "./screens/PaymentsScreen";
import { VerifyScreen } from "./screens/VerifyScreen";
import { EmployeeYouScreen } from "./screens/EmployeeYouScreen";
import { TallyScreen } from "../screens/TallyScreen";
import { colors, PillTabBar } from "../ui/kit";
import { onNavigate, useNotifications } from "../notifications/center";
import type { NavIconName } from "../ui/icons";

type Tab = "sell" | "payments" | "you";

const TABS: Array<{ key: Tab; label: string; icon: NavIconName }> = [
  { key: "sell", label: "Sell", icon: "cup" },
  { key: "payments", label: "Payments", icon: "card" },
  { key: "you", label: "You", icon: "person" },
];

export function EmployeeApp() {
  const [tab, setTab] = useState<Tab>("sell");
  const [verify, setVerify] = useState(false);
  const { unread, markRead } = useNotifications();

  // Notification tap → Payments.
  useEffect(() => {
    return onNavigate((target) => {
      if (target !== "payments") return;
      setVerify(false);
      setTab("payments");
    });
  }, []);

  useEffect(() => {
    if (tab === "payments" && !verify) markRead();
  }, [tab, verify, markRead]);

  const tabs = TABS.map((t) =>
    t.key === "payments" ? { ...t, badge: unread } : t,
  );
  // Prewarm after the first paint for instant tab switching.
  const [warm, setWarm] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setWarm(true), 900);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {verify ? (
          <VerifyScreen onBack={() => setVerify(false)} />
        ) : (
          <>
            <View style={[styles.tabPane, tab !== "sell" && styles.hidden]}>
              <TallyScreen onVerify={() => setVerify(true)} />
            </View>
            {warm || tab === "payments" ? (
              <View style={[styles.tabPane, tab !== "payments" && styles.hidden]}>
                <PaymentsScreen onScan={() => setVerify(true)} />
              </View>
            ) : null}
            {warm || tab === "you" ? (
              <View style={[styles.tabPane, tab !== "you" && styles.hidden]}>
                <EmployeeYouScreen />
              </View>
            ) : null}
          </>
        )}
      </View>
      <PillTabBar
        tabs={tabs}
        active={tab}
        onSelect={(next) => {
          setVerify(false);
          setTab(next);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { flex: 1 },
  tabPane: { flex: 1 },
  hidden: { display: "none" },
});
