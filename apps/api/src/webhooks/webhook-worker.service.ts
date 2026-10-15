import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { Job, Worker } from "bullmq";
import type Redis from "ioredis";
import { PrismaService } from "../prisma/prisma.service";
import { REDIS } from "../redis/redis.constants";
import { decryptWebhookSecret } from "./crypto/webhook-secret.crypto";
import { signWebhookPayload } from "./webhook-signature";
import {
  WEBHOOK_QUEUE_NAME,
  WebhookQueueService,
} from "./webhook-queue.service";

@Injectable()
export class WebhookWorkerService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(
    WebhookWorkerService.name,
  );

  private worker: Worker | null = null;
  private recoveryTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS)
    private readonly redis: Redis,
    private readonly queue: WebhookQueueService,
  ) {}

  onModuleInit() {
    this.worker = new Worker(
      WEBHOOK_QUEUE_NAME,
      async (
        job: Job<{ deliveryId: string }>,
      ) => {
        await this.deliver(
          job.data.deliveryId,
        );
      },
      {
        connection: this.redis,
        concurrency: Number(
          process.env.WEBHOOK_WORKER_CONCURRENCY ??
            10,
        ),
      },
    );

    this.worker.on(
      "failed",
      async (job, error) => {
        if (!job) return;

        this.logger.warn(
          `Webhook job ${job.id} failed: ${error.message}`,
        );

        const maxAttempts =
          job.opts.attempts ?? 1;
        const finalFailure =
          job.attemptsMade >= maxAttempts;

        const retryDelayMs =
          60_000 *
          Math.pow(
            2,
            Math.max(
              job.attemptsMade - 1,
              0,
            ),
          );

        await this.prisma.webhookDelivery.updateMany({
          where: {
            id: String(job.id),
          },
          data: {
            status: finalFailure
              ? "FAILED"
              : "PENDING",
            nextAttemptAt: finalFailure
              ? null
              : new Date(
                  Date.now() +
                    retryDelayMs,
                ),
          },
        });
      },
    );

    void this.recoverPending();

    this.recoveryTimer = setInterval(
      () => void this.recoverPending(),
      Number(
        process.env.WEBHOOK_RECOVERY_INTERVAL_MS ??
          60_000,
      ),
    );
  }

  async onModuleDestroy() {
    if (this.recoveryTimer) {
      clearInterval(this.recoveryTimer);
      this.recoveryTimer = null;
    }

    if (this.worker) {
      await this.worker.close();
      this.worker = null;
    }
  }

  private async recoverPending() {
    try {
      const pending =
        await this.prisma.webhookDelivery.findMany({
          where: {
            status: "PENDING",
            OR: [
              { nextAttemptAt: null },
              {
                nextAttemptAt: {
                  lte: new Date(),
                },
              },
            ],
          },
          orderBy: {
            createdAt: "asc",
          },
          take: 500,
          select: {
            id: true,
          },
        });

      for (const delivery of pending) {
        try {
          await this.queue.enqueue(
            delivery.id,
          );
        } catch (error) {
          this.logger.warn(
            `Webhook recovery could not enqueue ${delivery.id}: ${
              error instanceof Error
                ? error.message
                : String(error)
            }`,
          );
        }
      }
    } catch (error) {
      this.logger.warn(
        `Webhook recovery scan failed: ${
          error instanceof Error
            ? error.message
            : String(error)
        }`,
      );
    }
  }

  private async deliver(
    deliveryId: string,
  ) {
    const delivery =
      await this.prisma.webhookDelivery.findUnique({
        where: {
          id: deliveryId,
        },
        include: {
          endpoint: true,
        },
      });

    if (!delivery) return;

    if (
      delivery.status === "DELIVERED" ||
      delivery.status === "FAILED"
    ) {
      return;
    }

    await this.prisma.webhookDelivery.update({
      where: {
        id: delivery.id,
      },
      data: {
        attemptCount: {
          increment: 1,
        },
        nextAttemptAt: null,
      },
    });

    const endpoint = delivery.endpoint;

    if (
      !endpoint.enabled ||
      !endpoint.secretCiphertext ||
      !endpoint.secretIv ||
      !endpoint.secretTag
    ) {
      await this.prisma.webhookDelivery.update({
        where: {
          id: delivery.id,
        },
        data: {
          status: "FAILED",
          nextAttemptAt: null,
        },
      });

      throw new Error(
        "Webhook endpoint is not deliverable.",
      );
    }

    const secret = decryptWebhookSecret({
      ciphertext:
        endpoint.secretCiphertext,
      iv: endpoint.secretIv,
      tag: endpoint.secretTag,
    });

    const rawBody =
      JSON.stringify(delivery.payload);

    const timestamp =
      Math.floor(Date.now() / 1000);

    const signature =
      signWebhookPayload(
        secret,
        timestamp,
        rawBody,
      );

    const response = await fetch(
      endpoint.url,
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
          "User-Agent":
            "SeptemberFit-Webhooks/1.0",
          "September-Fit-Event-Id":
            delivery.eventId,
          "September-Fit-Timestamp":
            String(timestamp),
          "September-Fit-Signature":
            signature,
        },
        body: rawBody,
        signal: AbortSignal.timeout(
          10_000,
        ),
      },
    );

    await this.prisma.webhookDelivery.update({
      where: {
        id: delivery.id,
      },
      data: {
        lastResponseCode:
          response.status,
      },
    });

    if (!response.ok) {
      throw new Error(
        `Webhook returned HTTP ${response.status}`,
      );
    }

    await this.prisma.webhookDelivery.update({
      where: {
        id: delivery.id,
      },
      data: {
        status: "DELIVERED",
        deliveredAt: new Date(),
        nextAttemptAt: null,
      },
    });
  }
}
