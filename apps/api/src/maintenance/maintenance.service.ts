import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class MaintenanceService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(
    MaintenanceService.name,
  );
  private timer: NodeJS.Timeout | null = null;
  private startupTimer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    const interval = Number(
      process.env.MAINTENANCE_INTERVAL_MS ??
        6 * 60 * 60 * 1000,
    );

    this.timer = setInterval(
      () => void this.runOnce(),
      interval,
    );

    this.startupTimer = setTimeout(
      () => void this.runOnce(),
      30_000,
    );
  }

  onModuleDestroy() {
    if (this.startupTimer) {
      clearTimeout(this.startupTimer);
      this.startupTimer = null;
    }

    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async runOnce() {
    if (this.running) return;
    this.running = true;

    try {
      const now = new Date();
      const thirtyDaysAgo = new Date(
        Date.now() - 30 * DAY_MS,
      );

      await Promise.all([
        this.prisma.idempotencyKey.deleteMany({
          where: { expiresAt: { lt: now } },
        }),
        this.prisma.loginAttempt.deleteMany({
          where: {
            createdAt: {
              lt: thirtyDaysAgo,
            },
          },
        }),
        this.prisma.emailVerificationToken.deleteMany({
          where: { expiresAt: { lt: now } },
        }),
        this.prisma.passwordResetToken.deleteMany({
          where: { expiresAt: { lt: now } },
        }),
        this.prisma.teamInvitation.updateMany({
          where: {
            status: "PENDING",
            expiresAt: { lt: now },
          },
          data: { status: "EXPIRED" },
        }),
        this.prisma.feedbackRequest.updateMany({
          where: {
            status: "CREATED",
            expiresAt: { lt: now },
          },
          data: { status: "EXPIRED" },
        }),
        this.prisma.fitSession.updateMany({
          where: {
            status: {
              in: [
                "CREATED",
                "PROFILE_REQUIRED",
                "READY",
              ],
            },
            expiresAt: { lt: now },
          },
          data: { status: "EXPIRED" },
        }),
        this.prisma.merchantSession.deleteMany({
          where: {
            OR: [
              { expiresAt: { lt: thirtyDaysAgo } },
              {
                revokedAt: {
                  lt: thirtyDaysAgo,
                },
              },
            ],
          },
        }),
        this.prisma.apiRequestLog.deleteMany({
          where: {
            merchantId: null,
            createdAt: {
              lt: thirtyDaysAgo,
            },
          },
        }),
      ]);

      const subscriptions =
        await this.prisma.merchantSubscription.findMany({
          include: { plan: true },
        });

      for (const subscription of subscriptions) {
        const cutoff = new Date(
          Date.now() -
            subscription.plan.retentionDays *
              DAY_MS,
        );

        await this.prisma.apiRequestLog.deleteMany({
          where: {
            merchantId:
              subscription.merchantId,
            createdAt: { lt: cutoff },
          },
        });
      }
    } catch (error) {
      this.logger.error(
        "Maintenance cycle failed.",
        error,
      );
    } finally {
      this.running = false;
    }
  }
}
