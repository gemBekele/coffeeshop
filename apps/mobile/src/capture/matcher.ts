import { matchTemplateBest } from "@coffeeshop/shared";
import type { DeviceTemplate } from "../api/client";

export interface ParsedCapture {
  templateId: string;
  provider: string;
  direction: "CREDIT" | "DEBIT";
  amount: number;
  txnId?: string;
  sender?: string;
  senderPhone?: string;
}

/**
 * Match raw text (an SMS body or a notification body) against the shop's
 * active templates. Returns the first template that yields an amount.
 *
 * The server re-validates the same raw text on ingest, so this is only a
 * client-side filter to avoid posting irrelevant traffic.
 */
export function matchTemplates(
  templates: DeviceTemplate[],
  text: string,
): ParsedCapture | null {
  for (const def of templates) {
    const result = matchTemplateBest(def.templateBody, text, { caseInsensitive: true });
    if (result.matched && result.amount !== undefined) {
      return {
        templateId: def.id,
        provider: def.provider,
        direction: def.direction,
        amount: result.amount,
        txnId: result.txnId,
        sender: result.sender,
        senderPhone: result.senderPhone,
      };
    }
  }
  return null;
}
