import { PrismaClient, SmsProvider, TemplateStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const PIN_PEPPER = process.env.STAFF_PIN_PEPPER ?? "change-me-pin-pepper";

async function upsertItem(
  shopId: string,
  name: string,
  unit: string,
  stockOnHand: number,
  reorderLevel: number,
  cost: number,
) {
  return prisma.inventoryItem.upsert({
    where: { shopId_name: { shopId, name } },
    update: {},
    create: { shopId, name, unit, stockOnHand, reorderLevel, cost },
  });
}

async function upsertProduct(
  shopId: string,
  name: string,
  data: {
    categoryId: string;
    price: number;
    recipe: Array<{ inventoryItemId: string; quantity: number }>;
    variants?: Array<{ name: string; priceDelta: number }>;
  },
): Promise<void> {
  const existing = await prisma.product.findFirst({ where: { shopId, name } });
  if (existing) return;
  await prisma.product.create({
    data: {
      shopId,
      categoryId: data.categoryId,
      name,
      price: data.price,
      trackInventory: true,
      variants: data.variants ? { create: data.variants } : undefined,
      recipeIngredients: { create: data.recipe },
    },
  });
}

async function seedCatalog(shopId: string): Promise<void> {
  const beans = await upsertItem(shopId, "Coffee Beans", "g", 10000, 2000, 0.8);
  const milk = await upsertItem(shopId, "Milk", "ml", 8000, 2000, 0.05);
  const sugar = await upsertItem(shopId, "Sugar", "g", 4000, 800, 0.03);
  const cups = await upsertItem(shopId, "Paper Cups", "pcs", 500, 100, 3);
  const croissant = await upsertItem(
    shopId,
    "Croissant (frozen)",
    "pcs",
    60,
    20,
    15,
  );

  const espressoCat = await prisma.category.upsert({
    where: { shopId_name: { shopId, name: "Espresso Bar" } },
    update: {},
    create: { shopId, name: "Espresso Bar", sortOrder: 1 },
  });
  const bakeryCat = await prisma.category.upsert({
    where: { shopId_name: { shopId, name: "Bakery" } },
    update: {},
    create: { shopId, name: "Bakery", sortOrder: 2 },
  });

  await upsertProduct(shopId, "Espresso", {
    categoryId: espressoCat.id,
    price: 90,
    recipe: [
      { inventoryItemId: beans.id, quantity: 18 },
      { inventoryItemId: cups.id, quantity: 1 },
    ],
  });
  await upsertProduct(shopId, "Cappuccino", {
    categoryId: espressoCat.id,
    price: 120,
    variants: [
      { name: "Small", priceDelta: 0 },
      { name: "Large", priceDelta: 25 },
    ],
    recipe: [
      { inventoryItemId: beans.id, quantity: 18 },
      { inventoryItemId: milk.id, quantity: 150 },
      { inventoryItemId: cups.id, quantity: 1 },
    ],
  });
  await upsertProduct(shopId, "Macchiato", {
    categoryId: espressoCat.id,
    price: 110,
    recipe: [
      { inventoryItemId: beans.id, quantity: 20 },
      { inventoryItemId: milk.id, quantity: 60 },
      { inventoryItemId: sugar.id, quantity: 5 },
      { inventoryItemId: cups.id, quantity: 1 },
    ],
  });
  await upsertProduct(shopId, "Croissant", {
    categoryId: bakeryCat.id,
    price: 70,
    recipe: [{ inventoryItemId: croissant.id, quantity: 1 }],
  });
}

async function main() {
  const slug = process.env.SEED_SHOP_SLUG ?? "demo-cafe";
  const ownerEmail = process.env.SEED_OWNER_EMAIL ?? "owner@coffeeshop.local";
  const ownerPassword = process.env.SEED_OWNER_PASSWORD ?? "owner12345";
  const ownerPin = process.env.SEED_OWNER_PIN ?? "1234";

  const shop = await prisma.shop.upsert({
    where: { publicMenuSlug: slug },
    update: {},
    create: {
      name: "Demo Coffee House",
      currency: "ETB",
      timezone: "Africa/Addis_Ababa",
      publicMenuSlug: slug,
    },
  });

  const existingOwner = await prisma.staff.findUnique({
    where: { email: ownerEmail },
  });

  const owner = existingOwner
    ? existingOwner
    : await prisma.staff.create({
        data: {
          shopId: shop.id,
          fullName: "Shop Owner",
          email: ownerEmail,
          employeeCode: "CS-0001",
          role: "OWNER",
          passwordHash: await bcrypt.hash(ownerPassword, 10),
          pinHash: await bcrypt.hash(`${ownerPin}${PIN_PEPPER}`, 10),
        },
      });

  // Starter SMS template presets. Owners can clone and adjust these in the app.
  const presets: Array<{
    name: string;
    provider: SmsProvider;
    allowlist: string[];
    templateBody: string;
    sampleSms: string;
  }> = [
    {
      name: "Telebirr - received (preset)",
      provider: SmsProvider.TELEBIRR,
      allowlist: ["127"],
      templateBody:
        "You have received ETB {amount} from {senderName}({senderPhone}) on {date}. Your transaction number is {txnId}. Your current E-Money Account balance is ETB {balance}.",
      sampleSms:
        "Dear GEMEHU\nYou have received ETB 2.00 from Gemechu Girma(2519****4345)  on 12/10/2026 01:17:07. Your transaction number is DJC6OX8QZA. Your current E-Money Account balance is ETB 3.50.\nThank you for using telebirr\nEthio telecom",
    },
    {
      name: "CBE Birr - credited (preset)",
      provider: SmsProvider.CBE_BIRR,
      allowlist: ["CBE"],
      templateBody:
        "Dear Customer, your account has been credited with ETB {amount} from {sender}. Ref No: {txnId}. Balance: ETB {balance}.",
      sampleSms:
        "Dear Customer, your account has been credited with ETB 300.00 from 0912345678 (Abebe). Ref No: FT26011ABC. Balance: ETB 5,300.00.",
    },
    {
      name: "Amole - received (preset)",
      provider: SmsProvider.AMOLE,
      allowlist: ["Amole"],
      templateBody:
        "Amole: You have received ETB {amount} from {senderPhone}. Transaction number: {txnId}. Date: {date}.",
      sampleSms:
        "Amole: You have received ETB 150.00 from 0911223344. Transaction number: AM26011XY. Date: 11/10/2026.",
    },
    {
      name: "Awash - credited (preset)",
      provider: SmsProvider.AWASH,
      allowlist: ["Awash"],
      templateBody:
        "Awash Bank: Your account {account} is credited ETB {amount} by {senderPhone}. Txn ID {txnId}.",
      sampleSms:
        "Awash Bank: Your account 0132011234567 is credited ETB 500.00 by 0912345678. Txn ID AWB123456.",
    },
  ];

  for (const preset of presets) {
    const existing = await prisma.smsTemplate.findFirst({
      where: { shopId: shop.id, name: preset.name },
      select: { id: true },
    });
    if (existing) continue;
    await prisma.smsTemplate.create({
      data: {
        shopId: shop.id,
        name: preset.name,
        provider: preset.provider,
        direction: "CREDIT",
        status: TemplateStatus.ACTIVE,
        senderAllowlist: preset.allowlist,
        templateBody: preset.templateBody,
        sampleSms: preset.sampleSms,
        createdById: owner.id,
      },
    });
  }

  await seedCatalog(shop.id);

  // eslint-disable-next-line no-console
  console.log("Seed complete:");
  // eslint-disable-next-line no-console
  console.log(`  shop:  ${shop.name} (slug: ${shop.publicMenuSlug})`);
  // eslint-disable-next-line no-console
  console.log(`  owner: ${owner.email} / password: ${ownerPassword} / pin: ${ownerPin}`);
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
