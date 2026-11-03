import { buildTemplateFromSample, matchTemplateBest } from "@coffeeshop/shared";
import type { Api, SmsTemplate } from "../../api/client";

export interface AutoRuleResult {
  id: string;
  name: string;
  updated: boolean;
}

const PROVIDERS: Array<{
  re: RegExp;
  provider: "TELEBIRR" | "CBE_BIRR" | "AMOLE" | "AWASH" | "OTHER";
  label: string;
  allowlist: string[];
}> = [
  { re: /telebirr|ethio\s*telecom/i, provider: "TELEBIRR", label: "Telebirr", allowlist: ["127"] },
  { re: /cbe\s*birr|commercial\s*bank/i, provider: "CBE_BIRR", label: "CBE Birr", allowlist: ["CBE"] },
  { re: /\bamole\b/i, provider: "AMOLE", label: "Amole", allowlist: ["Amole"] },
  { re: /\bawash\b/i, provider: "AWASH", label: "Awash", allowlist: ["Awash"] },
];

function detectProvider(sample: string) {
  return PROVIDERS.find((p) => p.re.test(sample));
}

function matchingRule(
  templates: SmsTemplate[],
  sample: string,
): SmsTemplate | undefined {
  return templates.find(
    (t) => t.status === "ACTIVE" && matchTemplateBest(t.templateBody, sample).matched,
  );
}

/**
 * Turn a real message into an active rule.
 *
 * If an active rule already handles this format we update that rule instead of
 * creating a second one, so the shop always has one rule per bank format.
 */
export async function createOrUpdateRule(
  api: Api,
  sample: string,
): Promise<AutoRuleResult | null> {
  const templateBody = buildTemplateFromSample(sample);
  if (!templateBody) return null;

  const hit = detectProvider(sample);
  const templates = await api.templates().catch(() => [] as SmsTemplate[]);
  const existing = matchingRule(templates, sample);

  if (existing) {
    const updated = await api.updateTemplate(existing.id, {
      templateBody,
      sampleSms: sample,
      provider: hit?.provider ?? existing.provider,
      senderAllowlist: hit?.allowlist ?? existing.senderAllowlist,
      status: "ACTIVE",
    });
    await api.activateTemplate(updated.id);
    return { id: updated.id, name: updated.name, updated: true };
  }

  const created = await api.createTemplate({
    name: `${hit?.label ?? "Auto"} rule`,
    provider: hit?.provider ?? "OTHER",
    senderAllowlist: hit?.allowlist ?? [],
    direction: "CREDIT",
    status: "ACTIVE",
    templateBody,
    sampleSms: sample,
  });
  return { id: created.id, name: created.name, updated: false };
}
