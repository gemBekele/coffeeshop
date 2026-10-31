import React, { useCallback, useEffect, useState } from "react";
import { View } from "react-native";
import {
  Btn,
  Empty,
  ListRowCard,
  Loading,
  Screen,
} from "../../ui/kit";
import { useApp } from "../../state/AppContext";
import type { SmsTemplate } from "../../api/client";

export function TemplatesScreen({
  onBack,
  onEdit,
  onCreate,
}: {
  onBack: () => void;
  onEdit: (id: string) => void;
  onCreate: (sample?: string) => void;
}) {
  const { api } = useApp();
  const [templates, setTemplates] = useState<SmsTemplate[] | null>(null);

  const load = useCallback(() => {
    api.templates().then(setTemplates).catch(() => setTemplates([]));
  }, [api]);

  useEffect(load, [load]);

  return (
    <Screen
      title="Payment rules"
      onBack={onBack}
      footer={<Btn label="Add rule from message" onPress={() => onCreate()} />}
    >
      {templates === null ? (
        <Loading />
      ) : templates.length === 0 ? (
        <Empty text="No payment rules yet." />
      ) : (
        <View style={{ gap: 10 }}>
          {templates.map((t) => (
            <ListRowCard
              key={t.id}
              icon={t.status === "ACTIVE" ? "✓" : "○"}
              highlight={t.status === "ACTIVE"}
              title={t.name}
              subtitle={t.templateBody}
              rightTop={t.provider.replace("_", " ")}
              rightBottom={t.status === "ACTIVE" ? "Active" : "Tap to activate"}
              onPress={() => onEdit(t.id)}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}
