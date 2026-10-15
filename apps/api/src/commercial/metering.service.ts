import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { SubscriptionService } from "./subscription.service";
import type { MeteredMetric } from "./commercial.types";

@Injectable()
export class MeteringService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptions: SubscriptionService,
  ) {}

  async record(
    merchantId: string,
    metric: MeteredMetric,
    quantity = 1,
  ) {
    const subscription =
      await this.subscriptions.getOrCreateSubscription(
        merchantId,
      );

    return this.prisma.usageCounter.upsert({
      where: {
        merchantId_metric_periodStart: {
          merchantId,
          metric,
          periodStart:
            subscription.currentPeriodStart,
        },
      },
      update: {
        quantity: {
          increment: quantity,
        },
        periodEnd:
          subscription.currentPeriodEnd,
      },
      create: {
        merchantId,
        metric,
        periodStart:
          subscription.currentPeriodStart,
        periodEnd:
          subscription.currentPeriodEnd,
        quantity,
      },
    });
  }

  async summary(merchantId: string) {
    const subscription =
      await this.subscriptions.getOrCreateSubscription(
        merchantId,
      );

    const [
      counters,
      products,
      webhooks,
      apiKeys,
      teamMembers,
    ] = await Promise.all([
      this.prisma.usageCounter.findMany({
        where: {
          merchantId,
          periodStart:
            subscription.currentPeriodStart,
        },
      }),
      this.prisma.product.count({
        where: {
          merchantId,
          active: true,
        },
      }),
      this.prisma.webhookEndpoint.count({
        where: {
          merchantId,
          enabled: true,
        },
      }),
      this.prisma.apiKey.count({
        where: {
          merchantId,
          revokedAt: null,
        },
      }),
      this.prisma.merchantUser.count({
        where: {
          merchantId,
          disabledAt: null,
        },
      }),
    ]);

    const byMetric = new Map<string, number>(
      counters.map((counter) => [
        counter.metric,
        counter.quantity,
      ] as const),
    );

    const item = (
      used: number,
      limit: number | null,
    ) => ({
      used,
      limit,
      remaining:
        limit === null
          ? null
          : Math.max(limit - used, 0),
      percent:
        limit === null || limit === 0
          ? null
          : Math.min(
              Math.round((used / limit) * 1000) /
                10,
              100,
            ),
    });

    return {
      plan: subscription.plan.code,
      status: subscription.status,
      current_period_start:
        subscription.currentPeriodStart,
      current_period_end:
        subscription.currentPeriodEnd,
      usage: {
        fit_calculations: item(
          byMetric.get("FIT_CALCULATION") ?? 0,
          subscription.plan
            .fitCalculationsLimit,
        ),
        fit_sessions: item(
          byMetric.get("FIT_SESSION") ?? 0,
          subscription.plan.fitSessionsLimit,
        ),
        products: item(
          products,
          subscription.plan.productsLimit,
        ),
        webhooks: item(
          webhooks,
          subscription.plan.webhooksLimit,
        ),
        api_keys: item(
          apiKeys,
          subscription.plan.apiKeysLimit,
        ),
        team_members: item(
          teamMembers,
          subscription.plan
            .teamMembersLimit,
        ),
      },
    };
  }
}
