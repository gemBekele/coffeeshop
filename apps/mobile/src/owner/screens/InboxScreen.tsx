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
import { onSocketEvent } from "../../lib/socket";
import { useEffect } from "react";
import { createOrUpdateRule } from "../sms/autoRule";
import type { UnmatchedSms } from "../../api/client";

interface CreatedRule {
  id: string;
  name: string;
  sender: string | null;
  updated: boolean;
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
  const { api, syncCapture } = useApp();
  const [items, setItems] = useState<UnmatchedSms[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const running = useRef(false);
  const [created, setCreated] = useState<CreatedRule | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api.smsInbox().then(setItems).catch(() => setItems([]));
  }, [api]);

  useLive(load, 20000, { skipEvents: ["sms:unmatched"] });

  useEffect(() => {
    const off = onSocketEvent("sms:unmatched", (payload) => {
      const incoming = payload as UnmatchedSms | undefined;
      if (!incoming?.id || incoming.resolvedAt) return;
      setItems((prev) => {
        if (!prev) return prev;
        const exists = prev.some((i) => i.id === incoming.id);
        return exists
          ? prev.map((i) => (i.id === incoming.id ? { ...i, ...incoming } : i))
          : [incoming, ...prev];
      });
    });
    return off;
  }, []);

  const createRule = async (item: UnmatchedSms) => {
    if (running.current) return;
    running.current = true;
    setError(null);
    setBusyId(item.id);
    try {
      const rule = await createOrUpdateRule(api, item.body);
      if (!rule) {
        onUseSms(item.body);
        return;
      }
      void api.dismissSms(item.id).catch(() => {});
      setCreated({
        id: rule.id,
        name: rule.name,
        sender: item.sender,
        updated: rule.updated,
      });
      // Apply the rule to capture immediately; do not rescan older messages.
      void syncCapture(true).catch(() => {});
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
            Rule “{created.name}” was {created.updated ? "updated" : "created"}
            {created.sender ? ` for ${created.sender}` : ""}. Messages in this
            format become payments automatically from now on.
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
              />
            </Pressable>
          ))}
        </View>
      )}
    </Screen>
  );
}
