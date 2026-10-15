import { PrismaClient } from "@prisma/client";
import { generateApiKey } from "../src/auth/api-key.crypto";
import { hashPassword } from "../src/merchant-auth/password.crypto";

const prisma = new PrismaClient();

async function seedPlans() {
  const plans = [
    {
      code: "FREE",
      name: "Free",
      description:
        "Technical starter plan for development and small pilots.",
      monthlyPriceCents: 0,
      stripePriceId: null,
      fitCalculationsLimit: 100,
      fitSessionsLimit: 100,
      productsLimit: 50,
      webhooksLimit: 1,
      apiKeysLimit: 2,
      teamMembersLimit: 1,
      retentionDays: 30,
      sortOrder: 10,
      active: true,
    },
    {
      code: "STARTER",
      name: "Starter",
      description:
        "Draft commercial plan for small stores.",
      monthlyPriceCents: 2900,
      stripePriceId: process.env.STRIPE_PRICE_STARTER ?? null,
      fitCalculationsLimit: 1500,
      fitSessionsLimit: 1500,
      productsLimit: 500,
      webhooksLimit: 3,
      apiKeysLimit: 5,
      teamMembersLimit: 3,
      retentionDays: 90,
      sortOrder: 20,
      active: true,
    },
    {
      code: "GROWTH",
      name: "Growth",
      description:
        "Draft commercial plan for growing ecommerce stores.",
      monthlyPriceCents: 7900,
      stripePriceId: process.env.STRIPE_PRICE_GROWTH ?? null,
      fitCalculationsLimit: 10000,
      fitSessionsLimit: 10000,
      productsLimit: 5000,
      webhooksLimit: 10,
      apiKeysLimit: 15,
      teamMembersLimit: 10,
      retentionDays: 365,
      sortOrder: 30,
      active: true,
    },
    {
      code: "SCALE",
      name: "Scale",
      description:
        "Draft high-volume plan. Final pricing must be validated before launch.",
      monthlyPriceCents: 19900,
      stripePriceId: process.env.STRIPE_PRICE_SCALE ?? null,
      fitCalculationsLimit: 50000,
      fitSessionsLimit: 50000,
      productsLimit: 25000,
      webhooksLimit: 25,
      apiKeysLimit: 30,
      teamMembersLimit: 25,
      retentionDays: 730,
      sortOrder: 40,
      active: true,
    },
  ];

  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { code: plan.code },
      update: plan,
      create: plan,
    });
  }

  console.log(
    "September Fit plans seeded. Commercial prices are DRAFT.",
  );
}

async function main() {
  await seedPlans();

  const seedDemoData =
    process.env.SEED_DEMO_DATA === "true" ||
    (process.env.SEED_DEMO_DATA === undefined &&
      process.env.NODE_ENV !== "production");

  if (!seedDemoData) {
    console.log(
      "September Fit commercial plans seeded. Demo merchant data skipped.",
    );
    return;
  }

  const merchant = await prisma.merchant.upsert({
    where: { slug: "september-store" },
    update: {},
    create: {
      name: "September Store",
      slug: "september-store",
      status: "ACTIVE",
    },
  });

  const ownerEmail =
    process.env.SEED_OWNER_EMAIL ??
    "owner@septemberfit.local";
  const ownerPassword =
    process.env.SEED_OWNER_PASSWORD ??
    "ChangeMe123!";

  const owner = await prisma.merchantUser.upsert({
    where: {
      merchantId_email: {
        merchantId: merchant.id,
        email: ownerEmail.toLowerCase(),
      },
    },
    update: {
      role: "OWNER",
      passwordHash:
        hashPassword(ownerPassword),
      emailVerifiedAt: new Date(),
      disabledAt: null,
    },
    create: {
      merchantId: merchant.id,
      email: ownerEmail.toLowerCase(),
      role: "OWNER",
      passwordHash:
        hashPassword(ownerPassword),
      emailVerifiedAt: new Date(),
    },
  });

  const starterPlan =
    await prisma.plan.findUniqueOrThrow({
      where: { code: "STARTER" },
    });

  const now = new Date();
  const periodStart = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      1,
    ),
  );
  const periodEnd = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth() + 1,
      1,
    ),
  );

  await prisma.merchantSubscription.upsert({
    where: {
      merchantId: merchant.id,
    },
    update: {},
    create: {
      merchantId: merchant.id,
      planId: starterPlan.id,
      status: "TRIALING",
      trialEndsAt: new Date(
        Date.now() +
          14 * 24 * 60 * 60 * 1000,
      ),
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      billingProvider: "manual",
    },
  });

  for (const origin of [
    "http://localhost:3001",
    "http://localhost:3002",
    "https://shop.example.com",
  ]) {
    await prisma.allowedOrigin.upsert({
      where: {
        merchantId_origin: {
          merchantId: merchant.id,
          origin,
        },
      },
      update: {},
      create: {
        merchantId: merchant.id,
        origin,
      },
    });
  }

  const rawApiKey = generateApiKey("TEST");

  await prisma.apiKey.deleteMany({
    where: {
      merchantId: merchant.id,
      name: "Local development",
      environment: "TEST",
    },
  });

  await prisma.apiKey.create({
    data: {
      merchantId: merchant.id,
      environment: "TEST",
      name: "Local development",
      prefix: rawApiKey.prefix,
      lastFour: rawApiKey.lastFour,
      secretHash: rawApiKey.secretHash,
      scopes: [
        "fit:calculate",
        "products:read",
        "products:write",
        "profiles:read",
        "profiles:write",
        "sessions:write",
        "feedback:write",
        "analytics:read",
        "webhooks:manage",
      ],
    },
  });

  const product = await prisma.product.upsert({
    where: {
      merchantId_externalProductId: {
        merchantId: merchant.id,
        externalProductId: "SEP-0491",
      },
    },
    update: {
      name: "جاكيت جينز أوروبي",
      category: "JACKET",
      brand: "adidas",
      originalSizeLabel: "M",
      active: true,
    },
    create: {
      merchantId: merchant.id,
      externalProductId: "SEP-0491",
      sku: "SEP-0491",
      name: "جاكيت جينز أوروبي",
      category: "JACKET",
      brand: "adidas",
      originalSizeLabel: "M",
      active: true,
    },
  });

  const measurement =
    await prisma.garmentMeasurement.findFirst({
      where: {
        productId: product.id,
        active: true,
      },
      orderBy: {
        version: "desc",
      },
    });

  if (!measurement) {
    await prisma.garmentMeasurement.create({
      data: {
        productId: product.id,
        version: 1,
        quality: "VERIFIED",
        fitType: "REGULAR",
        stretchLevel: "NONE",
        chestWidthCm: 54,
        shoulderWidthCm: 46,
        sleeveLengthCm: 64,
        garmentLengthCm: 70,
        measuredBy: "seed",
        measuredAt: new Date(),
        active: true,
      },
    });
  }

  const customer = await prisma.customer.upsert({
    where: {
      merchantId_externalCustomerId: {
        merchantId: merchant.id,
        externalCustomerId: "customer_demo",
      },
    },
    update: {},
    create: {
      merchantId: merchant.id,
      externalCustomerId: "customer_demo",
    },
  });

  let profile =
    await prisma.fitProfile.findFirst({
      where: {
        merchantId: merchant.id,
        customerId: customer.id,
      },
    });

  if (!profile) {
    profile = await prisma.fitProfile.create({
      data: {
        merchantId: merchant.id,
        customerId: customer.id,
        profileType: "MENS",
        preferredFit: "REGULAR",
        heightCm: 178,
        weightKg: 68,
        chestCm: 98,
        shoulderCm: 44,
        sleeveCm: 62,
        waistCm: 80,
      },
    });
  }

  console.log("");
  console.log("September Fit seed complete");
  console.log("--------------------------------");
  console.log(`Merchant: ${merchant.name}`);
  console.log(
    `Dashboard owner: ${owner.email}`,
  );
  console.log(
    `Dashboard password: ${ownerPassword}`,
  );
  console.log(
    "Subscription: STARTER / 14-day TRIALING",
  );
  console.log(
    `Product public id: ${product.publicId}`,
  );
  console.log(
    `Profile public id: ${profile.publicId}`,
  );
  console.log(
    `TEST API KEY: ${rawApiKey.raw}`,
  );
  console.log("");
  console.log(
    "Save the API key now. Only its one-way hash is stored.",
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
