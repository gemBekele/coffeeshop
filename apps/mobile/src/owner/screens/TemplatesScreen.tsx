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
import type { SmsTemplate } from "../../api/client";

function toneFor(status: string): "invert" | "outline" | "muted" {
  if (status === "ACTIVE") return "invert";
  if (status === "DRAFT") return "outline";
  return "muted";
}

export function TemplatesScreen({
  onEdit,
  onCreate,
}: {
  onEdit: (id: string) => void;
  onCreate: (sample?: string) => void;
}) {
  const { api } = useApp();
  const [templates, setTemplates] = useState<SmsTemplate[] | null>(null);

  const load = useCallback(() => {
    api.templates().then(setTemplates).catch(() => setTemplates([]));
  }, [api]);

  useEffect(load, [load]);

  const active = (templates ?? []).filter((t) => t.status === "ACTIVE").length;

  return (
    <Screen
      title="Templates"
      footer={
        <Btn
          label="New template"
          onPress={() => onCreate()}
        />
      }
    >
      <Card tone={active > 0 ? "invert" : "muted"}>
        <Text
          style={{
            fontSize: 18,
            fontWeight: "800",
            color: active > 0 ? "#FFFFFF" : "#000000",
          }}
        >
          {active > 0
            ? `${active} active template${active > 1 ? "s" : ""}`
            : "No active templates — payments will not be read"}
        </Text>
      </Card>

      {templates === null ? (
        <Loading />
      ) : templates.length === 0 ? (
        <Empty text="No templates yet." />
      ) : (
        templates.map((t) => (
          <Card key={t.id}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Text style={{ fontSize: 20, fontWeight: "800", color: "#000000", flex: 1 }}>
                {t.name}
              </Text>
              <Badge label={t.status} tone={toneFor(t.status)} />
            </View>
            <Subtitle>
              {t.provider.replace("_", " ")} · {t.direction.toLowerCase()} · v{t.version}
            </Subtitle>
            <Text style={{ color: "#6B6B6B", fontSize: 14 }} numberOfLines={2}>
              {t.templateBody}
            </Text>
            <Btn
              label={t.status === "ACTIVE" ? "Edit" : "Edit & activate"}
              variant="outline"
              onPress={() => onEdit(t.id)}
            />
          </Card>
        ))
      )}
    </Screen>
  );
}