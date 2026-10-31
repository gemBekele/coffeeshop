import React, { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  Badge,
  Btn,
  Card,
  colors,
  Input,
  KeyValue,
  Loading,
  radius,
  Screen,
  Subtitle,
} from "../../ui/kit";
import { useApp } from "../../state/AppContext";
import {
  buildTemplateFromSpans,
  detectFields,
  matchTemplateBest,
  type FieldName,
} from "@coffeeshop/shared";

const PROVIDERS = [
  { label: "Telebirr", value: "TELEBIRR" },
  { label: "CBE Birr", value: "CBE_BIRR" },
  { label: "Amole", value: "AMOLE" },
  { label: "Awash", value: "AWASH" },
  { label: "Other", value: "OTHER" },
] as const;

function guessProvider(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes("telebirr") || lower.includes("127")) return "TELEBIRR";
  if (lower.includes("cbe") || lower.includes("commercial bank")) return "CBE_BIRR";
  if (lower.includes("amole") || lower.includes("dashen")) return "AMOLE";
  if (lower.includes("awash")) return "AWASH";
  return "OTHER";
}

function defaultNameFor(provider: string): string {
  const found = PROVIDERS.find((p) => p.value === provider);
  return `${found?.label ?? "Bank"} payment`;
}

export function TemplateEditorScreen({
  templateId,
  initialSample,
  onDone,
  onPickSms,
}: {
  templateId?: string;
  initialSample?: string;
  onDone: () => void;
  onPickSms: () => void;
}) {
  const { api, syncCapture } = useApp();
  const [loading, setLoading] = useState(!!templateId);
  const [name, setName] = useState("");
  const [provider, setProvider] = useState<string>("TELEBIRR");
  const [templateBody, setTemplateBody] = useState("");
  const [sampleSms, setSampleSms] = useState(initialSample ?? "");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applySample = (sms: string) => {
    setSampleSms(sms);
    setError(null);
    if (!sms.trim()) return;
    const guessed = guessProvider(sms);
    setProvider(guessed);
    if (!name) setName(defaultNameFor(guessed));
    const spans = detectFields(sms).filter((s) => s.field !== "currency");
    if (spans.length > 0) {
      const built = buildTemplateFromSpans(
        sms,
        spans.map((s) => ({
          field: s.field as FieldName,
          start: s.start,
          end: s.end,
        })),
      );
      setTemplateBody(built);
    }
  };

  useEffect(() => {
    if (initialSample && !templateId) {
      applySample(initialSample);
    }
  }, [initialSample, templateId]);

  useEffect(() => {
    if (!templateId) return;
    api
      .template(templateId)
      .then((t) => {
        setName(t.name);
        setProvider(t.provider);
        setTemplateBody(t.templateBody);
        setSampleSms(t.sampleSms ?? "");
      })
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, [api, templateId]);

  const preview = useMemo(() => {
    if (!templateBody.trim() || !sampleSms.trim()) return null;
    try {
      return matchTemplateBest(templateBody, sampleSms);
    } catch {
      return null;
    }
  }, [templateBody, sampleSms]);

  const saveAndActivate = async () => {
    setError(null);
    let bodyToSave = templateBody.trim();
    if (!bodyToSave && sampleSms.trim()) {
      const spans = detectFields(sampleSms);
      if (spans.length > 0) {
        bodyToSave = buildTemplateFromSpans(
          sampleSms,
          spans.map((s) => ({
            field: s.field as FieldName,
            start: s.start,
            end: s.end,
          })),
        );
        setTemplateBody(bodyToSave);
      }
    }
    if (!bodyToSave) {
      setError("Pick a payment message first so we can detect the format.");
      return;
    }
    setBusy(true);
    try {
      const payload = {
        name: name.trim() || defaultNameFor(provider),
        provider,
        direction: "CREDIT" as const,
        senderAllowlist: [],
        templateBody: bodyToSave,
        sampleSms: sampleSms || undefined,
      };
      if (templateId) {
        await api.updateTemplate(templateId, payload);
        await api.activateTemplate(templateId);
      } else {
        const created = await api.createTemplate(payload);
        await api.activateTemplate(created.id);
      }
      await syncCapture();
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <Screen title="Payment rule" onBack={onDone}>
        <Loading />
      </Screen>
    );
  }

  return (
    <Screen
      title={templateId ? "Payment rule" : "New payment rule"}
      onBack={onDone}
      footer={
        <Btn
          label={busy ? "Activating…" : "Activate rule"}
          onPress={saveAndActivate}
          disabled={busy}
        />
      }
    >
      <Card>
        <View style={styles.rowBetween}>
          <Text style={styles.cardHeading}>Sample message</Text>
          <Pressable onPress={onPickSms} style={styles.pickPill}>
            <Text style={styles.pickPillText}>
              {sampleSms ? "Pick another" : "Pick from phone"}
            </Text>
          </Pressable>
        </View>
        {sampleSms ? (
          <Text style={styles.sampleBox} numberOfLines={4}>
            {sampleSms}
          </Text>
        ) : (
          <Btn
            label="Pick a message from phone"
            variant="outline"
            onPress={onPickSms}
          />
        )}
      </Card>

      <View style={styles.chipRow}>
        {PROVIDERS.map((p) => {
          const active = provider === p.value;
          return (
            <Pressable
              key={p.value}
              onPress={() => {
                setProvider(p.value);
                if (!templateId) setName(defaultNameFor(p.value));
              }}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {p.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {preview && preview.matched ? (
        <Card>
          <View style={styles.rowBetween}>
            <Text style={styles.cardHeading}>Detected automatically</Text>
            <Badge label="Ready" tone="invert" />
          </View>
          <KeyValue
            label="Amount"
            value={
              preview.amount !== undefined
                ? `ETB ${preview.amount.toFixed(2)}`
                : "—"
            }
          />
          <KeyValue label="Transaction ID" value={preview.txnId ?? "—"} />
          {preview.sender || preview.senderName || preview.senderPhone ? (
            <KeyValue
              label="Sender"
              value={
                preview.sender ??
                preview.senderName ??
                preview.senderPhone ??
                "—"
              }
            />
          ) : null}
        </Card>
      ) : sampleSms ? (
        <Card tone="muted">
          <Subtitle>
            Could not auto-detect an amount in this message. Tap Customize below to mark {"{amount}"} and {"{txnId}"}.
          </Subtitle>
        </Card>
      ) : null}

      <Pressable
        onPress={() => setShowAdvanced((v) => !v)}
        style={styles.advancedToggle}
      >
        <Text style={styles.advancedText}>
          {showAdvanced ? "Hide pattern details ▲" : "Customize pattern ▼"}
        </Text>
      </Pressable>

      {showAdvanced ? (
        <Card>
          <Input
            label="Rule name"
            value={name}
            onChangeText={setName}
            placeholder="Telebirr payment"
          />
          <Input
            label="Message pattern"
            value={templateBody}
            onChangeText={setTemplateBody}
            placeholder="You have received ETB {amount} from {sender}. Txn {txnId}"
            multiline
          />
          <Input
            label="Or paste sample message"
            value={sampleSms}
            onChangeText={applySample}
            placeholder="Paste SMS text here"
            multiline
          />
        </Card>
      ) : null}

      {error ? (
        <Card tone="muted">
          <Subtitle>{error}</Subtitle>
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardHeading: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  pickPill: {
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.pill,
  },
  pickPillText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
  },
  sampleBox: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
    backgroundColor: colors.surfaceAlt,
    padding: 14,
    borderRadius: radius.control,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
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
  advancedToggle: {
    alignSelf: "center",
    paddingVertical: 6,
  },
  advancedText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textMuted,
  },
});
