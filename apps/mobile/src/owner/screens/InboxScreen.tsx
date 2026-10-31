import React, { useCallback, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import {
  Btn,
  Card,
  Empty,
  ListRowCard,
  Loading,
  Screen,
  Subtitle,
} from "../../ui/kit";
import { useApp } from "../../state/AppContext";
import { useLive } from "../../lib/live";
import { buildAutoRule } from "../sms/autoRule";
import type { UnmatchedSms } from "../../api/client";

interface CreatedRule {
  id: string;
  name: string;
  sender: string | null;
}

/**
 * Messages that arrived but matched no rule. Tapping one creates and activates
 * a rule in a single step; reviewing is optional.
 */
export function InboxScreen({
  onBack,
  onUseSms,
  onPickPhoneSms,
  onReviewTemplate,
}: {
  onBack?: () => void;
  onUseSms: (sample: string) => void;
  onPickPhoneSms?: () => void;
  onReviewTemplate?: (id: string) => void;
}) {
  const { api } = useApp();
  const [items, setItems] = useState<UnmatchedSms[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const running = useRef(false);
  const [created, setCreated] = useState<CreatedRule | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api.smsInbox().then(setItems).catch(() => setItems([]));
  }, [api]);

  useLive(load);

  const createRule = async (item: UnmatchedSms) => {
    if (running.current) return;
    running.current = true;
    setError(null);
    const rule = buildAutoRule(item.body);
    if (!rule) {
      running.current = false;
      onUseSms(item.body);
      return;
    }
    setBusyId(item.id);
    try {
      // Never create the same rule twice for identical message formats.
      const existing = await api.templates().catch(() => []);
      const duplicate = existing.find(
        (t) => t.status === "ACTIVE" && t.templateBody === rule.templateBody,
      );
      if (duplicate) {
        void api.dismissSms(item.id).catch(() => {});
        setCreated({ id: duplicate.id, name: duplicate.name, sender: item.sender });
        load();
        return;
      }
      const template = await api.createTemplate({
        ...rule,
        direction: "CREDIT",
        status: "ACTIVE",
        sampleSms: item.body,
      });
      void api.dismissSms(item.id).catch(() => {});
      setCreated({ id: template.id, name: template.name, sender: item.sender });
      load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyId(null);
      running.current = false;
    }
  };

  const open = (items ?? []).filter((i) => !i.resolvedAt);

  return (
    <Screen
      title="Messages"
      onBack={onBack}
      footer={
        onPickPhoneSms ? (
          <Btn label="Pick message from phone" onPress={onPickPhoneSms} />
        ) : undefined
      }
    >
      {created ? (
        <Card>
          <Subtitle>
            Rule “{created.name}” is active
            {created.sender ? ` for ${created.sender}` : ""}. New messages like
            this will become payments automatically.
          </Subtitle>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {onReviewTemplate ? (
              <Btn
                label="Review"
                size="md"
                variant="outline"
                onPress={() => onReviewTemplate(created.id)}
              />
            ) : null}
            <Btn label="Done" size="md" onPress={() => setCreated(null)} />
          </View>
        </Card>
      ) : null}

      {error ? <Subtitle>{error}</Subtitle> : null}

      {items === null ? (
        <Loading />
      ) : open.length === 0 ? (
        <Empty text="No unmatched messages. Everything the shop received became a payment." />
      ) : (
        <View style={{ gap: 10 }}>
          {open.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => void createRule(item)}
              disabled={busyId === item.id}
              style={({ pressed }) => (pressed ? { opacity: 0.7 } : undefined)}
            >
              <ListRowCard
                icon="!"
                highlight
                title={item.sender ?? "Unknown sender"}
                subtitle={item.body}
                rightTop={busyId === item.id ? "Adding…" : "Add rule"}
                rightBottom="One tap"
              />
            </Pressable>
          ))}
        </View>
      )}
    </Screen>
  );
}
