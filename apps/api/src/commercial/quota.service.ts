import {
  HttpException,
  Injectable,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { SubscriptionService } from "./subscription.service";
import type {
  MeteredMetric,
  ResourceQuota,
} from "./commercial.types";

@Injectable()
export class QuotaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptions: SubscriptionService,
  ) {}

  async assertMetricAvailable(
    merchantId: string,
    metric: MeteredMetric,
  ) {
    const subscription =
      await this.subscriptions.getOrCreateSubscription(
        merchantId,
      );

    const limit =
      metric === "FIT_CALCULATION"
        ? subscription.plan.fitCalculationsLimit
        : subscription.plan.fitSessionsLimit;

    if (limit === null) return;

    const counter =
      await this.prisma.usageCounter.findUnique({
        where: {
          merchantId_metric_periodStart: {
            merchantId,
            metric,
            periodStart:
              subscription.currentPeriodStart,
          },
        },
      });

    const used = counter?.quantity ?? 0;

    if (used >= limit) {
      throw this.limitError(
        subscription.plan.code,
        metric,
        used,
        limit,
      );
    }
  }

  async assertResourceAvailable(
    merchantId: string,
    resource: ResourceQuota,
  ) {
    const subscription =
      await this.subscriptions.getOrCreateSubscription(
        merchantId,
      );

    let used = 0;
    let limit: number | null = null;

    if (resource === "PRODUCTS") {
      used = await this.prisma.product.count({
        where: {
          merchantId,
          active: true,
        },
      });
      limit = subscription.plan.productsLimit;
    }

    if (resource === "WEBHOOKS") {
      used =
        await this.prisma.webhookEndpoint.count({
          where: {
            merchantId,
            enabled: true,
          },
        });
      limit = subscription.plan.webhooksLimit;
    }

    if (resource === "API_KEYS") {
      used = await this.prisma.apiKey.count({
        where: {
          merchantId,
          revokedAt: null,
        },
      });
      limit = subscription.plan.apiKeysLimit;
    }

    if (resource === "TEAM_MEMBERS") {
      used =
        await this.prisma.merchantUser.count({
          where: {
            merchantId,
            disabledAt: null,
          },
        });
      limit =
        subscription.plan.teamMembersLimit;
    }

    if (limit !== null && used >= limit) {
      throw this.limitError(
        subscription.plan.code,
        resource,
        used,
        limit,
      );
    }
  }

  private limitError(
    planCode: string,
    metric: string,
    used: number,
    limit: number,
  ) {
    return new HttpException(
      {
        code: "PLAN_LIMIT_REACHED",
        message:
          "The current plan limit has been reached.",
        plan: planCode,
        metric,
        used,
        limit,
        upgrade_required: true,
      },
      402,
    );
  }
}
