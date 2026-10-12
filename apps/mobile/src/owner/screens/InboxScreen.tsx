import React, { useCallback, useEffect, useState } from "react";
import { Text, View } from "react-native";
import {
  Badge,
  Btn,
  Card,
  Empty,
  Loading,
  Screen,
  Subtitle,
} from "../../ui/kit";
import { useApp } from "../../state/AppContext";
import type { UnmatchedSms } from "../../api/client";

export function InboxScreen({ onUseSms }: { onUseSms: (sample: string) => void }) {
  const { api } = useApp();
  const [items, setItems] = useState<UnmatchedSms[] | null>(null);

  const load = useCallback(() => {
    api.smsInbox().then(setItems).catch(() => setItems([]));
  }, [api]);

  useEffect(load, [load]);

  const open = (items ?? []).filter((i) => !i.resolvedAt);

  return (
    <Screen title="Unmatched SMS" footer={<Btn label="Reload" onPress={load} variant="outline" />}>
      <Card tone={open.length > 0 ? "invert" : "muted"}>
        <Text
          style={{
            fontSize: 18,
            fontWeight: "800",
            color: open.length > 0 ? "#FFFFFF" : "#000000",
          }}
        >
          {open.length > 0
            ? `${open.length} message${open.length > 1 ? "s" : ""} need a template`
            : "Inbox is clear"}
        </Text>
      </Card>

      {items === null ? (
        <Loading />
      ) : items.length === 0 ? (
        <Empty text="Nothing waiting." />
      ) : (
        items.map((item) => (
          <Card key={item.id} tone={item.resolvedAt ? "muted" : "plain"}>
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 4 }}>
              <Badge label={item.sender ?? "unknown"} tone="muted" />
              {item.resolvedAt ? <Badge label="dismissed" tone="muted" /> : null}
            </View>
            <Text style={{ fontSize: 16, lineHeight: 22, color: "#000000" }}>
              {item.body}
            </Text>
            {!item.resolvedAt ? (
              <>
                <Btn
                  label="Build template from this"
                  onPress={() => onUseSms(item.body)}
                />
                <Btn
                  label="Dismiss"
                  variant="outline"
                  onPress={async () => {
                    await api.dismissSms(item.id).catch(() => {});
                    load();
                  }}
                />
              </>
            ) : null}
          </Card>
        ))
      )}
    </Screen>
  );
}