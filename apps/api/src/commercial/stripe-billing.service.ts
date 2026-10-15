import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import Stripe from "stripe";
import type Redis from "ioredis";
import { REDIS } from "../redis/redis.constants";
import { PrismaService } from "../prisma/prisma.service";
import { SubscriptionService } from "./subscription.service";

@Injectable()
export class StripeBillingService {
  private readonly logger =
    new Logger(StripeBillingService.name);

  private readonly stripe: Stripe | null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptions: SubscriptionService,
    @Inject(REDIS)
    private readonly redis: Redis,
  ) {
    const secret =
      process.env.STRIPE_SECRET_KEY;

    this.stripe = secret
      ? new Stripe(secret)
      : null;
  }

  private client() {
    if (!this.stripe) {
      throw new BadRequestException(
        "Stripe is not configured. Set STRIPE_SECRET_KEY.",
      );
    }

    return this.stripe;
  }

  async createCheckout(
    merchantId: string,
    userId: string,
    planCode: string,
  ) {
    const lockKey =
      `billing:checkout:${merchantId}`;
    const lockToken = randomUUID();

    const acquired = await this.redis.set(
      lockKey,
      lockToken,
      "EX",
      30,
      "NX",
    );

    if (!acquired) {
      throw new ConflictException(
        "A billing checkout is already being created. Retry shortly.",
      );
    }

    try {
      return await this.createCheckoutUnlocked(
        merchantId,
        userId,
        planCode,
      );
    } finally {
      await this.redis
        .eval(
          `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end`,
          1,
          lockKey,
          lockToken,
        )
        .catch(() => undefined);
    }
  }

  private async createCheckoutUnlocked(
    merchantId: string,
    userId: string,
    planCode: string,
  ) {
    const stripe = this.client();

    const plan =
      await this.prisma.plan.findFirst({
        where: {
          code: planCode.toUpperCase(),
          active: true,
        },
      });

    if (!plan) {
      throw new NotFoundException(
        "Plan not found.",
      );
    }

    if (plan.monthlyPriceCents <= 0) {
      throw new BadRequestException(
        "Free plan does not require Stripe Checkout.",
      );
    }

    const priceId =
      plan.stripePriceId ??
      this.priceIdFromEnv(plan.code);

    if (!priceId) {
      throw new BadRequestException(
        `Stripe price is not configured for ${plan.code}.`,
      );
    }

    const existingCheckoutRequest =
      await this.prisma.planChangeRequest.findFirst({
        where: {
          merchantId,
          status: "PENDING",
          note: {
            startsWith: "Stripe Checkout ",
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

    if (
      existingCheckoutRequest?.note
    ) {
      const checkoutId =
        existingCheckoutRequest.note.replace(
          "Stripe Checkout ",
          "",
        );

      try {
        const existingSession =
          await stripe.checkout.sessions.retrieve(
            checkoutId,
          );

        if (
          existingCheckoutRequest.requestedPlanId ===
            plan.id &&
          existingSession.status === "open" &&
          existingSession.url
        ) {
          return {
            provider: "stripe",
            checkout_session_id:
              existingSession.id,
            checkout_url:
              existingSession.url,
            plan_code: plan.code,
            reused: true,
          };
        }

        if (
          existingSession.status === "open"
        ) {
          await stripe.checkout.sessions.expire(
            existingSession.id,
          );
        }
      } catch (error) {
        this.logger.warn(
          `Could not reuse/expire previous Stripe Checkout ${checkoutId}: ${
            error instanceof Error
              ? error.message
              : String(error)
          }`,
        );
      }

      await this.prisma.planChangeRequest.update({
        where: {
          id: existingCheckoutRequest.id,
        },
        data: {
          status: "CANCELED",
          resolvedAt: new Date(),
        },
      });
    }

    const merchant =
      await this.prisma.merchant.findUniqueOrThrow({
        where: { id: merchantId },
      });

    const user =
      await this.prisma.merchantUser.findFirst({
        where: {
          id: userId,
          merchantId,
          disabledAt: null,
        },
      });

    if (!user) {
      throw new NotFoundException(
        "Merchant user not found.",
      );
    }

    const subscription =
      await this.subscriptions.getOrCreateSubscription(
        merchantId,
      );

    if (
      subscription.billingProvider === "stripe" &&
      subscription.billingSubscriptionRef
    ) {
      throw new ConflictException({
        code: "BILLING_PORTAL_REQUIRED",
        message:
          "This merchant already has a Stripe subscription. Use the billing portal to manage it.",
      });
    }

    let customerRef =
      subscription.billingCustomerRef;

    if (!customerRef) {
      const customer =
        await stripe.customers.create({
          name: merchant.name,
          email: user.email,
          metadata: {
            merchantId,
            merchantPublicId:
              merchant.publicId,
          },
        });

      customerRef = customer.id;

      await this.prisma.merchantSubscription.update({
        where: { merchantId },
        data: {
          billingProvider: "stripe",
          billingCustomerRef:
            customerRef,
        },
      });
    }

    const dashboardBase = (
      process.env.DASHBOARD_PUBLIC_URL ??
      "http://localhost:3002"
    ).replace(/\/+$/, "");

    const automaticTax =
      process.env.STRIPE_AUTOMATIC_TAX ===
      "true";

    const checkout =
      await stripe.checkout.sessions.create({
        mode: "subscription",
        customer: customerRef,
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        success_url:
          `${dashboardBase}/?billing=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url:
          `${dashboardBase}/?billing=cancelled`,
        client_reference_id:
          merchant.publicId,
        allow_promotion_codes: true,
        tax_id_collection: {
          enabled: true,
        },
        automatic_tax: {
          enabled: automaticTax,
        },
        billing_address_collection:
          automaticTax
            ? "required"
            : "auto",
        customer_update: {
          address: "auto",
          name: "auto",
        },
        metadata: {
          merchantId,
          merchantPublicId:
            merchant.publicId,
          planCode: plan.code,
          requestedByUserId: userId,
        },
        subscription_data: {
          metadata: {
            merchantId,
            merchantPublicId:
              merchant.publicId,
            planCode: plan.code,
          },
        },
      });

    if (!checkout.url) {
      throw new BadRequestException(
        "Stripe Checkout did not return a URL.",
      );
    }

    await this.prisma.planChangeRequest.create({
      data: {
        merchantId,
        requestedPlanId: plan.id,
        requestedByUserId: userId,
        status: "PENDING",
        note: `Stripe Checkout ${checkout.id}`,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        merchantId,
        actorType: "merchant_user",
        actorId: userId,
        action: "billing.checkout.created",
        objectType: "stripe_checkout_session",
        objectId: checkout.id,
        metadata: {
          planCode: plan.code,
          priceId,
        },
      },
    });

    return {
      provider: "stripe",
      checkout_session_id:
        checkout.id,
      checkout_url: checkout.url,
      plan_code: plan.code,
    };
  }

  async createPortal(
    merchantId: string,
  ) {
    const stripe = this.client();

    const subscription =
      await this.subscriptions.getOrCreateSubscription(
        merchantId,
      );

    if (
      subscription.billingProvider !==
        "stripe" ||
      !subscription.billingCustomerRef
    ) {
      throw new BadRequestException(
        "No Stripe customer exists for this merchant.",
      );
    }

    const dashboardBase = (
      process.env.DASHBOARD_PUBLIC_URL ??
      "http://localhost:3002"
    ).replace(/\/+$/, "");

    const portal =
      await stripe.billingPortal.sessions.create({
        customer:
          subscription.billingCustomerRef,
        return_url:
          `${dashboardBase}/?billing=portal_return`,
        ...(process.env
          .STRIPE_PORTAL_CONFIGURATION_ID
          ? {
              configuration:
                process.env
                  .STRIPE_PORTAL_CONFIGURATION_ID,
            }
          : {}),
      });

    return {
      provider: "stripe",
      portal_url: portal.url,
    };
  }

  constructEvent(
    rawBody: Buffer,
    signature: string,
  ) {
    const stripe = this.client();

    const secret =
      process.env.STRIPE_WEBHOOK_SECRET;

    if (!secret) {
      throw new BadRequestException(
        "STRIPE_WEBHOOK_SECRET is not configured.",
      );
    }

    return stripe.webhooks.constructEvent(
      rawBody,
      signature,
      secret,
    );
  }

  async processEvent(
    event: Stripe.Event,
  ) {
    const existing =
      await this.prisma.billingProviderEvent.findUnique({
        where: {
          provider_providerEventId: {
            provider: "stripe",
            providerEventId: event.id,
          },
        },
      });

    if (existing?.processedAt) {
      return {
        received: true,
        duplicate: true,
      };
    }

    const eventRow = existing
      ? existing
      : await this.prisma.billingProviderEvent.create({
          data: {
            provider: "stripe",
            providerEventId:
              event.id,
            eventType: event.type,
          },
        });

    try {
      switch (event.type) {
        case "checkout.session.completed":
          await this.onCheckoutCompleted(
            event.data.object as any,
          );
          break;

        case "customer.subscription.created":
        case "customer.subscription.updated":
          await this.onSubscriptionChanged(
            event.data.object as any,
          );
          break;

        case "customer.subscription.deleted":
          await this.onSubscriptionDeleted(
            event.data.object as any,
          );
          break;

        case "invoice.paid":
        case "invoice.payment_succeeded":
          await this.onInvoice(
            event.data.object as any,
            true,
          );
          break;

        case "invoice.payment_failed":
          await this.onInvoice(
            event.data.object as any,
            false,
          );
          break;

        default:
          this.logger.debug(
            `Ignoring Stripe event ${event.type}`,
          );
      }

      await this.prisma.billingProviderEvent.update({
        where: {
          id: eventRow.id,
        },
        data: {
          processedAt: new Date(),
          errorMessage: null,
        },
      });

      return {
        received: true,
        duplicate: false,
      };
    } catch (error) {
      await this.prisma.billingProviderEvent.update({
        where: {
          id: eventRow.id,
        },
        data: {
          errorMessage:
            error instanceof Error
              ? error.message
              : String(error),
        },
      });

      throw error;
    }
  }

  private async onCheckoutCompleted(
    session: any,
  ) {
    const merchantId =
      session.metadata?.merchantId;

    if (!merchantId) {
      throw new Error(
        "Stripe Checkout session is missing merchantId metadata.",
      );
    }

    const subscriptionRef =
      typeof session.subscription ===
      "string"
        ? session.subscription
        : session.subscription?.id;

    const customerRef =
      typeof session.customer ===
      "string"
        ? session.customer
        : session.customer?.id;

    await this.prisma.merchantSubscription.update({
      where: { merchantId },
      data: {
        billingProvider: "stripe",
        billingCustomerRef:
          customerRef ?? undefined,
        billingSubscriptionRef:
          subscriptionRef ?? undefined,
      },
    });

    if (subscriptionRef) {
      const subscription =
        await this.client().subscriptions.retrieve(
          subscriptionRef,
        );

      await this.onSubscriptionChanged(
        subscription as any,
      );
    }
  }

  private async onSubscriptionChanged(
    subscription: any,
  ) {
    const merchantId =
      subscription.metadata?.merchantId;

    if (!merchantId) {
      this.logger.warn(
        `Stripe subscription ${subscription.id} has no merchantId metadata.`,
      );
      return;
    }

    const priceId =
      subscription.items?.data?.[0]
        ?.price?.id;

    const plan =
      await this.planFromStripePrice(
        priceId,
      );

    if (!plan) {
      throw new Error(
        `No September Fit plan maps to Stripe price ${priceId}.`,
      );
    }

    const currentPeriodStart =
      this.unixToDate(
        subscription.current_period_start,
      );

    const currentPeriodEnd =
      this.unixToDate(
        subscription.current_period_end,
      );

    const mappedStatus =
      this.mapStripeStatus(
        subscription.status,
      );

    if (mappedStatus === "CANCELED") {
      await this.fallbackToFree(
        merchantId,
        subscription.id,
      );
      return;
    }

    await this.prisma.merchantSubscription.update({
      where: { merchantId },
      data: {
        planId: plan.id,
        status: mappedStatus,
        trialEndsAt:
          this.unixToDate(
            subscription.trial_end,
          ),
        currentPeriodStart:
          currentPeriodStart ??
          new Date(),
        currentPeriodEnd:
          currentPeriodEnd ??
          new Date(
            Date.now() +
              30 * 24 * 60 * 60 * 1000,
          ),
        cancelAtPeriodEnd:
          Boolean(
            subscription.cancel_at_period_end,
          ),
        billingProvider: "stripe",
        billingCustomerRef:
          typeof subscription.customer ===
          "string"
            ? subscription.customer
            : subscription.customer?.id,
        billingSubscriptionRef:
          subscription.id,
      },
    });

    await this.prisma.planChangeRequest.updateMany({
      where: {
        merchantId,
        requestedPlanId: plan.id,
        status: "PENDING",
      },
      data: {
        status: "APPROVED",
        resolvedAt: new Date(),
      },
    });

    await this.prisma.auditLog.create({
      data: {
        merchantId,
        actorType:
          "billing_provider",
        actorId: "stripe",
        action:
          "billing.subscription.synced",
        objectType:
          "merchant_subscription",
        objectId:
          subscription.id,
        metadata: {
          stripeStatus:
            subscription.status,
          planCode: plan.code,
          priceId,
          cancelAtPeriodEnd:
            Boolean(
              subscription.cancel_at_period_end,
            ),
        },
      },
    });
  }

  private async onSubscriptionDeleted(
    subscription: any,
  ) {
    const merchantId =
      subscription.metadata?.merchantId;

    if (!merchantId) return;

    await this.fallbackToFree(
      merchantId,
      subscription.id,
    );
  }

  private async fallbackToFree(
    merchantId: string,
    providerSubscriptionRef: string,
  ) {
    const freePlan =
      await this.prisma.plan.findUniqueOrThrow({
        where: { code: "FREE" },
      });

    const now = new Date();
    const periodEnd = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth() + 1,
        1,
      ),
    );

    await this.prisma.merchantSubscription.update({
      where: { merchantId },
      data: {
        planId: freePlan.id,
        status: "ACTIVE",
        trialEndsAt: null,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
        billingProvider: "stripe",
        billingSubscriptionRef: null,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        merchantId,
        actorType:
          "billing_provider",
        actorId: "stripe",
        action:
          "billing.subscription.ended",
        objectType:
          "merchant_subscription",
        objectId:
          providerSubscriptionRef,
        metadata: {
          fallbackPlan: "FREE",
        },
      },
    });
  }

  private async onInvoice(
    invoice: any,
    paid: boolean,
  ) {
    const customerRef =
      typeof invoice.customer ===
      "string"
        ? invoice.customer
        : invoice.customer?.id;

    if (!customerRef) return;

    const merchantSubscription =
      await this.prisma.merchantSubscription.findFirst({
        where: {
          billingProvider: "stripe",
          billingCustomerRef:
            customerRef,
        },
      });

    if (!merchantSubscription) {
      return;
    }

    const merchantId =
      merchantSubscription.merchantId;

    await this.prisma.billingInvoice.upsert({
      where: {
        provider_externalRef: {
          provider: "stripe",
          externalRef: invoice.id,
        },
      },
      update: {
        status:
          invoice.status ??
          (paid
            ? "paid"
            : "payment_failed"),
        amountDueCents:
          invoice.amount_due ?? 0,
        amountPaidCents:
          invoice.amount_paid ?? 0,
        hostedInvoiceUrl:
          invoice.hosted_invoice_url ??
          null,
        invoicePdfUrl:
          invoice.invoice_pdf ?? null,
        periodStart:
          this.unixToDate(
            invoice.period_start,
          ),
        periodEnd:
          this.unixToDate(
            invoice.period_end,
          ),
      },
      create: {
        merchantId,
        provider: "stripe",
        externalRef: invoice.id,
        status:
          invoice.status ??
          (paid
            ? "paid"
            : "payment_failed"),
        currency:
          String(
            invoice.currency ?? "eur",
          ).toUpperCase(),
        amountDueCents:
          invoice.amount_due ?? 0,
        amountPaidCents:
          invoice.amount_paid ?? 0,
        hostedInvoiceUrl:
          invoice.hosted_invoice_url ??
          null,
        invoicePdfUrl:
          invoice.invoice_pdf ?? null,
        periodStart:
          this.unixToDate(
            invoice.period_start,
          ),
        periodEnd:
          this.unixToDate(
            invoice.period_end,
          ),
      },
    });

    if (
      paid &&
      merchantSubscription.status ===
        "PAST_DUE"
    ) {
      await this.prisma.merchantSubscription.update({
        where: { merchantId },
        data: {
          status: "ACTIVE",
        },
      });
    }

    if (!paid) {
      await this.prisma.merchantSubscription.update({
        where: { merchantId },
        data: {
          status: "PAST_DUE",
        },
      });
    }
  }

  async listInvoices(
    merchantId: string,
  ) {
    const invoices =
      await this.prisma.billingInvoice.findMany({
        where: { merchantId },
        orderBy: { createdAt: "desc" },
        take: 100,
      });

    return {
      data: invoices.map(
        (invoice) => ({
          id: invoice.externalRef,
          status: invoice.status,
          currency: invoice.currency,
          amount_due_cents:
            invoice.amountDueCents,
          amount_paid_cents:
            invoice.amountPaidCents,
          hosted_invoice_url:
            invoice.hostedInvoiceUrl,
          invoice_pdf_url:
            invoice.invoicePdfUrl,
          period_start:
            invoice.periodStart,
          period_end:
            invoice.periodEnd,
          created_at:
            invoice.createdAt,
        }),
      ),
    };
  }

  private async planFromStripePrice(
    priceId?: string | null,
  ) {
    if (!priceId) return null;

    const direct =
      await this.prisma.plan.findFirst({
        where: {
          stripePriceId: priceId,
        },
      });

    if (direct) return direct;

    const plans =
      await this.prisma.plan.findMany({
        where: { active: true },
      });

    return (
      plans.find(
        (plan) =>
          this.priceIdFromEnv(
            plan.code,
          ) === priceId,
      ) ?? null
    );
  }

  private priceIdFromEnv(
    planCode: string,
  ) {
    const key =
      `STRIPE_PRICE_${planCode.toUpperCase()}`;

    return process.env[key] ?? null;
  }

  private mapStripeStatus(
    status: string,
  ):
    | "TRIALING"
    | "ACTIVE"
    | "PAST_DUE"
    | "CANCELED" {
    if (status === "trialing") {
      return "TRIALING";
    }

    if (status === "active") {
      return "ACTIVE";
    }

    if (
      status === "past_due" ||
      status === "unpaid" ||
      status === "incomplete"
    ) {
      return "PAST_DUE";
    }

    return "CANCELED";
  }

  private unixToDate(
    value?: number | null,
  ) {
    if (
      value === undefined ||
      value === null
    ) {
      return null;
    }

    return new Date(value * 1000);
  }
}
