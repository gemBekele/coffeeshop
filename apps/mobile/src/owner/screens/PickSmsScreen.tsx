import React, { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import {
  Badge,
  Btn,
  Card,
  Empty,
  Loading,
  Screen,
  SectionTitle,
  Subtitle,
} from "../../ui/kit";
import { readSms, requestSmsPermission, isSmsModuleAvailable } from "../../sms/reader";
import type { RawSms } from "../../sms/reader";

/**
 * "SMS picking" — lets the owner pick a real message from the phone inbox and
 * use it as the template sample. Previously there was no way to pull a real
 * SMS in, which made template building painful.
 */
export function PickSmsScreen({
  onPick,
  onBack,
}: {
  onPick: (body: string) => void;
  onBack: () => void;
}) {
  const [messages, setMessages] = useState<RawSms[] | null>(null);
  const [filter, setFilter] = useState<"all" | "money">("all");
  const [status, setStatus] = useState<string | null>(null);

  const load = useCallback(async () => {
    setMessages(null);
    setStatus(null);
    if (!isSmsModuleAvailable()) {
      setStatus(
        "Native SMS module not available. Install a development build to pick SMS.",
      );
      return;
    }
    const granted = await requestSmsPermission();
    if (!granted) {
      setStatus("SMS permission was denied. Enable it in Settings → Permissions.");
      return;
    }
    const all = await readSms(80);
    // Newest first.
    all.sort((a: RawSms, b: RawSms) => b.date - a.date);
    setMessages(all);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const MONEY_WORDS =
    /received|credited|transferred|payment|balance|etb|birr|telebirr|cbe|amole|awash|deposit|withdraw/i;

  const visible = (messages ?? []).filter((m) =>
    filter === "money" ? MONEY_WORDS.test(m.body) : true,
  );

  return (
    <Screen title="Pick an SMS" onBack={onBack} scroll={false}>
      {status ? (
        <View style={{ gap: 12 }}>
          <Card tone="muted">
            <Subtitle>{status}</Subtitle>
          </Card>
          <Btn label="Try again" onPress={load} variant="outline" />
        </View>
      ) : messages === null ? (
        <Loading label="Reading inbox" />
      ) : visible.length === 0 ? (
        <Empty
          text={
            filter === "money"
              ? "No payment-looking messages found."
              : "No messages found on this phone."
          }
          action={<Btn label="Reload" onPress={load} variant="outline" />}
        />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}
          ListHeaderComponent={
            <View style={{ paddingBottom: 8, gap: 10 }}>
              <Btn
                label={filter === "money" ? "Showing: payment only" : "Showing: all"}
                onPress={() => setFilter(filter === "money" ? "all" : "money")}
                variant="outline"
                size="sm"
              />
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => onPick(item.body)}
              style={({ pressed }) => [cardStyle, pressed && { opacity: 0.6 }]}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={sender}>{item.address || "unknown"}</Text>
                {MONEY_WORDS.test(item.body) ? (
                  <Badge label="payment" tone="invert" />
                ) : null}
              </View>
              <Text style={body} numberOfLines={4}>
                {item.body}
              </Text>
            </Pressable>
          )}
        />
      )}
    </Screen>
  );
}

const cardStyle = {
  borderWidth: 2,
  borderColor: "#000000",
  padding: 14,
  gap: 8,
  backgroundColor: "#FFFFFF",
};
const sender = { fontSize: 13, fontWeight: "900" as const, color: "#000000", letterSpacing: 0.6 };
const body = { fontSize: 16, color: "#000000", lineHeight: 22 };