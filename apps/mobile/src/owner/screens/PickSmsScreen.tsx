import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import {
  Badge,
  Btn,
  Card,
  colors,
  Empty,
  Loading,
  radius,
  Screen,
  Subtitle,
} from "../../ui/kit";
import {
  isSmsModuleAvailable,
  readSms,
  requestSmsPermission,
  type RawSms,
} from "../../sms/reader";
import { notificationCapture } from "../../notifications/service";

const MONEY_WORDS =
  /\b(etb|birr|telebirr|cbe|amole|awash)\b/i;

type Filter = "all" | "payments" | "notifications";

export function PickSmsScreen({
  onPick,
  onBack,
}: {
  onPick: (body: string) => void;
  onBack: () => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [inbox, setInbox] = useState<RawSms[] | null>(null);
  const [captured, setCaptured] = useState<RawSms[]>([]);
  const [ntfGranted, setNtfGranted] = useState(
    notificationCapture.isPermissionGranted(),
  );

  const loadAll = useCallback(async () => {
    setNtfGranted(notificationCapture.isPermissionGranted());
    notificationCapture.watch();
    const currentCaptured = notificationCapture.getCapturedSms();
    setCaptured(
      currentCaptured.map((n) => ({
        id: `ntf-${n.packageName}-${n.id}-${n.postedAt}`,
        address: n.title || n.appLabel || n.packageName,
        body: n.body || n.text,
        date: n.postedAt,
        source: "NOTIFICATION" as const,
      })),
    );

    if (!isSmsModuleAvailable()) {
      setInbox([]);
      return;
    }
    const granted = await requestSmsPermission();
    if (!granted) {
      setInbox([]);
      return;
    }
    const all = await readSms(80);
    setInbox(all);
  }, []);

  useEffect(() => {
    void loadAll();
    const unsub = notificationCapture.onCapturedSms((items) => {
      setCaptured(
        items.map((n) => ({
          id: `ntf-${n.packageName}-${n.id}-${n.postedAt}`,
          address: n.title || n.appLabel || n.packageName,
          body: n.body || n.text,
          date: n.postedAt,
          source: "NOTIFICATION" as const,
        })),
      );
    });
    return unsub;
  }, [loadAll]);

  const combined = useMemo(() => {
    const list = [...captured, ...(inbox ?? [])];
    list.sort((a, b) => {
      const aMoney = MONEY_WORDS.test(a.body) ? 1 : 0;
      const bMoney = MONEY_WORDS.test(b.body) ? 1 : 0;
      if (aMoney !== bMoney) return bMoney - aMoney;
      return b.date - a.date;
    });
    if (filter === "payments") {
      return list.filter((m) => MONEY_WORDS.test(m.body));
    }
    if (filter === "notifications") {
      return list.filter((m) => m.source === "NOTIFICATION");
    }
    return list;
  }, [captured, inbox, filter]);

  const chips: Array<{ key: Filter; label: string }> = [
    { key: "all", label: "All messages" },
    { key: "payments", label: "Payments" },
    {
      key: "notifications",
      label: `Notifications (${captured.length})`,
    },
  ];

  return (
    <Screen title="Pick a message" onBack={onBack} scroll={false}>
      <View style={styles.chipRow}>
        {chips.map((c) => {
          const active = filter === c.key;
          return (
            <Pressable
              key={c.key}
              onPress={() => setFilter(c.key)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {c.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {!ntfGranted ? (
        <Card tone="muted">
          <Subtitle>
            Grant notification access so live SMS and bank alerts appear here automatically.
          </Subtitle>
          <Btn
            label="Enable notification listener"
            size="md"
            onPress={() => notificationCapture.openPermissionSettings()}
          />
        </Card>
      ) : null}

      {inbox === null ? (
        <Loading label="Reading messages" />
      ) : combined.length === 0 ? (
        <Empty
          text={
            filter === "notifications"
              ? "No notifications captured yet. Keep notification access on and tap Refresh when a message arrives."
              : "No matching messages found."
          }
          action={<Btn label="Refresh" variant="outline" size="md" onPress={loadAll} />}
        />
      ) : (
        <FlatList
          data={combined}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ gap: 10, paddingBottom: 36 }}
          renderItem={({ item }) => {
            const isPayment = MONEY_WORDS.test(item.body);
            return (
              <Pressable
                onPress={() => onPick(item.body)}
                style={({ pressed }) => [
                  styles.msgCard,
                  pressed && { opacity: 0.65 },
                ]}
              >
                <View
                  style={[
                    styles.iconCircle,
                    isPayment && { backgroundColor: colors.brand },
                  ]}
                >
                  <Text
                    style={[
                      styles.iconText,
                      isPayment && { color: colors.onInverse },
                    ]}
                  >
                    {isPayment ? "↓" : "✉"}
                  </Text>
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={styles.msgTop}>
                    <Text style={styles.sender} numberOfLines={1}>
                      {item.address || "Message"}
                    </Text>
                    <Badge
                      label={
                        item.source === "NOTIFICATION" ? "Notification" : "SMS"
                      }
                      tone={isPayment ? "invert" : "muted"}
                    />
                  </View>
                  <Text style={styles.body} numberOfLines={3}>
                    {item.body}
                  </Text>
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chipRow: {
    flexDirection: "row",
    gap: 8,
    paddingBottom: 4,
  },
  chip: {
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.pill,
  },
  chipActive: {
    backgroundColor: colors.brand,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textMuted,
  },
  chipTextActive: {
    color: colors.onInverse,
  },
  msgCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 16,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
  },
  msgTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  sender: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
    flex: 1,
  },
  body: {
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 20,
  },
});
