import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

function calendarMonthPeriod(now = new Date()) {
  const start = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      1,
      0,
      0,
      0,
      0,
    ),
  );

  const end = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth() + 1,
      1,
      0,
      0,
      0,
      0,
    ),
  );

  return { start, end };
}

@Injectable()
export class SubscriptionService {
  constructor(private readonly prisma: PrismaService) {}

  async listPlans() {
    const plans = await this.prisma.plan.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { monthlyPriceCents: "asc" }],
    });

    return {
      pricing_status: "DRAFT",
      currency_note:
        "Seed prices are technical defaults and should be finalized before public launch.",
      data: plans.map((plan) => this.serializePlan(plan)),
    };
  }

  async getOrCreateSubscription(merchantId: string) {
    let subscription =
      await this.prisma.merchantSubscription.findUnique({
        where: { merchantId },
        include: { plan: true },
      });

    if (!subscription) {
      const freePlan = await this.prisma.plan.findUnique({
        where: { code: "FREE" },
      });

      if (!freePlan) {
        throw new NotFoundException(
          "FREE plan is not configured. Run the database seed.",
        );
      }

      const period = calendarMonthPeriod();

      subscription =
        await this.prisma.merchantSubscription.create({
          data: {
            merchantId,
            planId: freePlan.id,
            status: "ACTIVE",
            currentPeriodStart: period.start,
            currentPeriodEnd: period.end,
          },
          include: { plan: true },
        });
    }

    if (
      subscription.status === "TRIALING" &&
      subscription.trialEndsAt &&
      subscription.trialEndsAt <= new Date() &&
      !subscription.billingSubscriptionRef
    ) {
      const freePlan =
        await this.prisma.plan.findUniqueOrThrow({
          where: { code: "FREE" },
        });

      const period = calendarMonthPeriod();

      subscription =
        await this.prisma.merchantSubscription.update({
          where: { merchantId },
          data: {
            planId: freePlan.id,
            status: "ACTIVE",
            trialEndsAt: null,
            currentPeriodStart: period.start,
            currentPeriodEnd: period.end,
            billingProvider: null,
          },
          include: { plan: true },
        });
    }

    if (
      subscription.currentPeriodEnd <= new Date() &&
      !subscription.billingSubscriptionRef
    ) {
      const period = calendarMonthPeriod();

      subscription =
        await this.prisma.merchantSubscription.update({
          where: { merchantId },
          data: {
            currentPeriodStart: period.start,
            currentPeriodEnd: period.end,
          },
          include: { plan: true },
        });
    }

    return subscription;
  }

  async getSubscriptionSummary(merchantId: string) {
    const subscription =
      await this.getOrCreateSubscription(merchantId);

    return {
      id: subscription.id,
      status: subscription.status,
      plan: this.serializePlan(subscription.plan),
      trial_ends_at: subscription.trialEndsAt,
      current_period_start:
        subscription.currentPeriodStart,
      current_period_end:
        subscription.currentPeriodEnd,
      cancel_at_period_end:
        subscription.cancelAtPeriodEnd,
      billing_provider:
        subscription.billingProvider,
      billing_managed:
        Boolean(
          subscription.billingCustomerRef,
        ),
      has_active_provider_subscription:
        Boolean(
          subscription.billingSubscriptionRef,
        ),
    };
  }

  async requestPlanChange(
    merchantId: string,
    userId: string,
    planCode: string,
  ) {
    const requestedPlan =
      await this.prisma.plan.findFirst({
        where: {
          code: planCode.toUpperCase(),
          active: true,
        },
      });

    if (!requestedPlan) {
      throw new NotFoundException("Plan not found.");
    }

    const subscription =
      await this.getOrCreateSubscription(merchantId);

    if (subscription.planId === requestedPlan.id) {
      throw new ConflictException(
        "Merchant is already on this plan.",
      );
    }

    if (requestedPlan.monthlyPriceCents === 0) {
      if (subscription.billingSubscriptionRef) {
        throw new ConflictException({
          code: "BILLING_PORTAL_REQUIRED",
          message:
            "Cancel the active paid subscription in the billing portal before moving to the free plan.",
        });
      }

      const period = calendarMonthPeriod();

      await this.prisma.merchantSubscription.update({
        where: { merchantId },
        data: {
          planId: requestedPlan.id,
          status: "ACTIVE",
          trialEndsAt: null,
          currentPeriodStart: period.start,
          currentPeriodEnd: period.end,
          cancelAtPeriodEnd: false,
        },
      });

      const approved =
        await this.prisma.planChangeRequest.create({
          data: {
            merchantId,
            requestedPlanId: requestedPlan.id,
            requestedByUserId: userId,
            status: "APPROVED",
            resolvedAt: new Date(),
            note: "Immediate free-plan change; no active paid provider subscription.",
          },
        });

      await this.prisma.auditLog.create({
        data: {
          merchantId,
          actorType: "merchant_user",
          actorId: userId,
          action: "billing.plan_change.approved",
          objectType: "plan_change_request",
          objectId: approved.id,
          metadata: {
            requestedPlan: requestedPlan.code,
            paymentRequired: false,
          },
        },
      });

      return {
        request_id: approved.publicId,
        status: approved.status,
        plan: this.serializePlan(requestedPlan),
        payment_required: false,
      };
    }

    const existing =
      await this.prisma.planChangeRequest.findFirst({
        where: {
          merchantId,
          requestedPlanId: requestedPlan.id,
          status: "PENDING",
        },
      });

    if (existing) {
      return {
        request_id: existing.publicId,
        status: existing.status,
        plan: this.serializePlan(requestedPlan),
        payment_required:
          requestedPlan.monthlyPriceCents > 0,
      };
    }

    const request =
      await this.prisma.planChangeRequest.create({
        data: {
          merchantId,
          requestedPlanId: requestedPlan.id,
          requestedByUserId: userId,
          status: "PENDING",
        },
      });

    await this.prisma.auditLog.create({
      data: {
        merchantId,
        actorType: "merchant_user",
        actorId: userId,
        action: "billing.plan_change.requested",
        objectType: "plan_change_request",
        objectId: request.id,
        metadata: {
          requestedPlan: requestedPlan.code,
          monthlyPriceCents:
            requestedPlan.monthlyPriceCents,
        },
      },
    });

    return {
      request_id: request.publicId,
      status: request.status,
      plan: this.serializePlan(requestedPlan),
      payment_required:
        requestedPlan.monthlyPriceCents > 0,
      next_step:
        requestedPlan.monthlyPriceCents > 0
          ? "Connect a payment provider to turn this request into a checkout flow."
          : "The request can be approved by billing operations.",
    };
  }

  async listPlanChangeRequests(merchantId: string) {
    const rows =
      await this.prisma.planChangeRequest.findMany({
        where: { merchantId },
        include: { requestedPlan: true },
        orderBy: { createdAt: "desc" },
        take: 50,
      });

    return {
      data: rows.map((row) => ({
        id: row.publicId,
        status: row.status,
        plan: this.serializePlan(row.requestedPlan),
        created_at: row.createdAt,
        resolved_at: row.resolvedAt,
      })),
    };
  }

  serializePlan(plan: {
    code: string;
    name: string;
    description: string | null;
    monthlyPriceCents: number;
    currency: string;
    fitCalculationsLimit: number | null;
    fitSessionsLimit: number | null;
    productsLimit: number | null;
    webhooksLimit: number | null;
    apiKeysLimit: number | null;
    teamMembersLimit: number | null;
    retentionDays: number;
  }) {
    return {
      code: plan.code,
      name: plan.name,
      description: plan.description,
      monthly_price_cents:
        plan.monthlyPriceCents,
      currency: plan.currency,
      limits: {
        fit_calculations:
          plan.fitCalculationsLimit,
        fit_sessions: plan.fitSessionsLimit,
        products: plan.productsLimit,
        webhooks: plan.webhooksLimit,
        api_keys: plan.apiKeysLimit,
        team_members: plan.teamMembersLimit,
        retention_days: plan.retentionDays,
      },
    };
  }
}
