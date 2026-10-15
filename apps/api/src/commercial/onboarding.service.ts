import {
  ConflictException,
  Injectable,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { SubscriptionService } from "./subscription.service";

@Injectable()
export class OnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptions: SubscriptionService,
  ) {}

  async status(merchantId: string) {
    const [
      merchant,
      subscription,
      origins,
      apiKeys,
      products,
      measuredProducts,
      results,
    ] = await Promise.all([
      this.prisma.merchant.findUniqueOrThrow({
        where: { id: merchantId },
      }),
      this.subscriptions.getOrCreateSubscription(
        merchantId,
      ),
      this.prisma.allowedOrigin.count({
        where: { merchantId },
      }),
      this.prisma.apiKey.count({
        where: {
          merchantId,
          revokedAt: null,
        },
      }),
      this.prisma.product.count({
        where: {
          merchantId,
          active: true,
        },
      }),
      this.prisma.product.count({
        where: {
          merchantId,
          active: true,
          measurements: {
            some: {
              active: true,
            },
          },
        },
      }),
      this.prisma.fitResult.count({
        where: { merchantId },
      }),
    ]);

    const checklist = [
      {
        key: "subscription",
        label: "الخطة",
        required: true,
        complete: Boolean(subscription),
      },
      {
        key: "origin",
        label: "إضافة دومين المتجر",
        required: true,
        complete: origins > 0,
      },
      {
        key: "api_key",
        label: "إنشاء API Key",
        required: true,
        complete: apiKeys > 0,
      },
      {
        key: "product",
        label: "إضافة أول منتج",
        required: true,
        complete: products > 0,
      },
      {
        key: "measurements",
        label: "إضافة قياسات منتج",
        required: true,
        complete: measuredProducts > 0,
      },
      {
        key: "test_fit",
        label: "تنفيذ أول Fit تجريبي",
        required: false,
        complete: results > 0,
      },
    ];

    const required = checklist.filter(
      (item) => item.required,
    );

    const readyForLive = required.every(
      (item) => item.complete,
    );

    return {
      completed_at:
        merchant.onboardingCompletedAt,
      ready_for_live: readyForLive,
      checklist,
      progress_percent: Math.round(
        (checklist.filter((item) => item.complete)
          .length /
          checklist.length) *
          100,
      ),
    };
  }

  async complete(merchantId: string) {
    const current = await this.status(merchantId);

    if (!current.ready_for_live) {
      throw new ConflictException({
        code: "ONBOARDING_INCOMPLETE",
        message:
          "Complete all required onboarding steps first.",
        checklist: current.checklist,
      });
    }

    const merchant =
      await this.prisma.merchant.update({
        where: { id: merchantId },
        data: {
          onboardingCompletedAt: new Date(),
        },
      });

    return {
      completed: true,
      completed_at:
        merchant.onboardingCompletedAt,
    };
  }
}
