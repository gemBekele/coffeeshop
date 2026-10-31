import { prisma } from "./prisma.js";
import type { SmsProvider } from "@coffeeshop/shared";

export interface StarterTemplate {
  name: string;
  provider: SmsProvider;
  allowlist: string[];
  templateBody: string;
  sampleSms: string;
}

/**
 * Starter SMS formats for Ethiopian payment providers. New shops get these
 * active so payment capture works immediately after registration.
 */
export const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    name: "Telebirr - received (preset)",
    provider: "TELEBIRR" as SmsProvider,
    allowlist: ["127"],
    templateBody:
      "You have received ETB {amount} from {senderName}({senderPhone}) on {date}. Your transaction number is {txnId}. Your current E-Money Account balance is ETB {balance}.",
    sampleSms:
      "Dear GEMEHU\nYou have received ETB 2.00 from Gemechu Girma(2519****4345)  on 12/10/2026 01:17:07. Your transaction number is DJC6OX8QZA. Your current E-Money Account balance is ETB 3.50.\nThank you for using telebirr\nEthio telecom",
  },
  {
    name: "CBE Birr - credited (preset)",
    provider: "CBE_BIRR" as SmsProvider,
    allowlist: ["CBE"],
    templateBody:
      "Dear Customer, your account has been credited with ETB {amount} from {sender}. Ref No: {txnId}. Balance: ETB {balance}.",
    sampleSms:
      "Dear Customer, your account has been credited with ETB 300.00 from 0912345678 (Abebe). Ref No: FT26011ABC. Balance: ETB 5,300.00.",
  },
  {
    name: "Amole - received (preset)",
    provider: "AMOLE" as SmsProvider,
    allowlist: ["Amole"],
    templateBody:
      "Amole: You have received ETB {amount} from {senderPhone}. Transaction number: {txnId}. Date: {date}.",
    sampleSms:
      "Amole: You have received ETB 150.00 from 0911223344. Transaction number: AM26011XY. Date: 11/10/2026.",
  },
  {
    name: "Awash - credited (preset)",
    provider: "AWASH" as SmsProvider,
    allowlist: ["Awash"],
    templateBody:
      "Awash Bank: Your account {account} is credited ETB {amount} by {senderPhone}. Txn ID {txnId}.",
    sampleSms:
      "Awash Bank: Your account 0132011234567 is credited ETB 500.00 by 0912345678. Txn ID AWB123456.",
  },
];

export async function seedStarterTemplates(
  shopId: string,
  createdById: string,
): Promise<void> {
  for (const preset of STARTER_TEMPLATES) {
    const existing = await prisma.smsTemplate.findFirst({
      where: { shopId, name: preset.name },
      select: { id: true },
    });
    if (existing) continue;
    await prisma.smsTemplate.create({
      data: {
        shopId,
        name: preset.name,
        provider: preset.provider,
        direction: "CREDIT",
        status: "ACTIVE",
        senderAllowlist: preset.allowlist,
        templateBody: preset.templateBody,
        sampleSms: preset.sampleSms,
        createdById,
      },
    });
  }
}
