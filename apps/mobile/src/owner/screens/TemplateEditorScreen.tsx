import React, { useEffect, useState } from "react";
import { View } from "react-native";
import {
  Badge,
  Btn,
  BtnRow,
  Card,
  Dropdown,
  Input,
  Loading,
  Screen,
  SectionTitle,
  Subtitle,
} from "../../ui/kit";
import { useApp } from "../../state/AppContext";
import type { TemplateDiagnostics } from "../../api/client";
import { buildTemplateFromSpans, detectFields, type FieldName } from "@coffeeshop/shared";

const PROVIDERS = [
  { label: "Telebirr", value: "TELEBIRR" },
  { label: "CBE Birr", value: "CBE_BIRR" },
  { label: "Amole", value: "AMOLE" },
  { label: "Awash", value: "AWASH" },
  { label: "Other", value: "OTHER" },
] as const;

const DIRECTIONS = [
  { label: "Credit — money in", value: "CREDIT" as const },
  { label: "Debit — money out", value: "DEBIT" as const },
];

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
  const { api } = useApp();
  const [loading, setLoading] = useState(!!templateId);
  const [name, setName] = useState("");
  const [provider, setProvider] = useState<string>("TELEBIRR");
  const [direction, setDirection] = useState<"CREDIT" | "DEBIT">("CREDIT");
  const [allowlist, setAllowlist] = useState("");
  const [templateBody, setTemplateBody] = useState("");
  const [sampleSms, setSampleSms] = useState(initialSample ?? "");
  const [diag, setDiag] = useState<TemplateDiagnostics | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!templateId) return;
    api
      .template(templateId)
      .then((t) => {
        setName(t.name);
        setProvider(t.provider);
        setDirection(t.direction);
        setAllowlist(t.senderAllowlist.join(", "));
        setTemplateBody(t.templateBody);
        setSampleSms(t.sampleSms ?? "");
      })
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, [api, templateId]);

  const autoFill = () => {
    setError(null);
    if (!sampleSms.trim()) {
      setError("Paste a sample SMS or pick one from your phone first.");
      return;
    }
    const spans = detectFields(sampleSms);
    if (spans.length === 0) {
      setError("Could not detect any fields in that SMS.");
      return;
    }
    setTemplateBody(
      buildTemplateFromSpans(
        sampleSms,
        spans.map((s) => ({ field: s.field as FieldName, start: s.start, end: s.end })),
      ),
    );
    setMessage(`Detected ${spans.length} field(s). Test it below.`);
  };

  const runTest = async () => {
    setError(null);
    try {
      const result = await api.testTemplate(templateBody, sampleSms);
      setDiag(result);
      setMessage(
        result.extraction?.matched
          ? `Matched · amount=${result.extraction.amount ?? "?"} · txn=${result.extraction.txnId ?? "—"}`
          : "Template did not match the sample SMS.",
      );
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const save = async (activate: boolean) => {
    setError(null);
    setMessage(null);
    if (!templateBody.trim()) {
      setError("Template body is empty — use Auto-detect first.");
      return;
    }
    const payload = {
      name: name || "Untitled template",
      provider,
      direction,
      senderAllowlist: allowlist
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      templateBody,
      sampleSms: sampleSms || undefined,
    };
    try {
      if (templateId) {
        await api.updateTemplate(templateId, payload);
        if (activate) await api.activateTemplate(templateId);
      } else {
        const created = await api.createTemplate(payload);
        if (activate) await api.activateTemplate(created.id);
      }
      onDone();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  if (loading) {
    return (
      <Screen title="Template">
        <Loading />
      </Screen>
    );
  }

  return (
    <Screen
      title={templateId ? "Edit template" : "New template"}
      onBack={onDone}
      footer={
        <>
          <BtnRow>
            <Btn
              label="Save draft"
              variant="outline"
              onPress={() => save(false)}
              size="md"
            />
            <Btn label="Save & activate" onPress={() => save(true)} size="md" />
          </BtnRow>
        </>
      }
    >
      <Input
        label="Name"
        value={name}
        onChangeText={setName}
        placeholder="Telebirr received"
      />

      <Dropdown
        label="Provider"
        title="Choose provider"
        options={PROVIDERS.map((p) => ({ label: p.label, value: p.value }))}
        value={provider}
        onChange={setProvider}
      />

      <Dropdown
        label="Direction"
        title="Choose direction"
        options={DIRECTIONS}
        value={direction}
        onChange={setDirection}
      />

      <Input
        label="Sender allowlist"
        value={allowlist}
        onChangeText={setAllowlist}
        placeholder="127, Telebirr"
      />

      <Card>
        <SectionTitle>Sample SMS</SectionTitle>
        <Subtitle>
          Pick a real message from this phone, or paste one below.
        </Subtitle>
        <Btn label="📱 Pick SMS from phone" onPress={onPickSms} variant="outline" />
        <Input
          value={sampleSms}
          onChangeText={setSampleSms}
          placeholder="Paste a payment SMS here"
          multiline
        />
        <Btn label="Auto-detect fields → template" onPress={autoFill} />
      </Card>

      <Card>
        <SectionTitle>Template body</SectionTitle>
        <Input
          value={templateBody}
          onChangeText={setTemplateBody}
          placeholder="You have received ETB {amount} from {sender}. ID {txnId}"
          multiline
        />
        {diag ? (
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              <Badge label={`${diag.fields.length} fields`} tone="invert" />
              <Badge
                label={diag.hasAmount ? "has amount" : "no amount"}
                tone={diag.hasAmount ? "outline" : "muted"}
              />
              <Badge
                label={diag.extraction?.matched ? "matches sample" : "no match"}
                tone={diag.extraction?.matched ? "invert" : "muted"}
              />
            </View>
            {diag.warnings.map((w, i) => (
              <Subtitle key={i}>{w}</Subtitle>
            ))}
          </View>
        ) : null}
        <Btn label="Test against sample" onPress={runTest} variant="outline" />
      </Card>

      {message ? <Subtitle>{message}</Subtitle> : null}
      {error ? <Subtitle>{error}</Subtitle> : null}
    </Screen>
  );
}