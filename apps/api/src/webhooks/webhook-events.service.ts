import { Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { WebhookQueueService } from "./webhook-queue.service";

@Injectable()
export class WebhookEventsService {
  private readonly logger = new Logger(
    WebhookEventsService.name,
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: WebhookQueueService,
  ) {}

  async emit(
    merchantId: string,
    eventType: string,
    data: Record<string, unknown>,
  ) {
    const endpoints = await this.prisma.webhookEndpoint.findMany({
      where: {
        merchantId,
        enabled: true,
        events: {
          has: eventType,
        },
      },
    });

    if (endpoints.length === 0) return;

    const eventId = `evt_${randomUUID()}`;
    const payload = {
      id: eventId,
      type: eventType,
      created_at: new Date().toISOString(),
      data,
    };

    const deliveries = [];

    for (const endpoint of endpoints) {
      const delivery =
        await this.prisma.webhookDelivery.create({
          data: {
            merchantId,
            webhookEndpointId:
              endpoint.id,
            eventId,
            eventType,
            payload,
            status: "PENDING",
            attemptCount: 0,
            nextAttemptAt: new Date(),
          },
        });

      deliveries.push(delivery);
    }

    for (const delivery of deliveries) {
      try {
        await this.queue.enqueue(
          delivery.id,
        );
      } catch (error) {
        // The PostgreSQL delivery row remains PENDING.
        // The recovery loop will enqueue it when Redis is available again.
        this.logger.error(
          `Failed to enqueue webhook delivery ${delivery.id}.`,
          error,
        );
      }
    }
  }
}
