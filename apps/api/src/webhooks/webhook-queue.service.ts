import {
  Inject,
  Injectable,
  OnModuleDestroy,
} from "@nestjs/common";
import { Queue } from "bullmq";
import type Redis from "ioredis";
import { REDIS } from "../redis/redis.constants";

export const WEBHOOK_QUEUE_NAME =
  "september-fit-webhooks";

@Injectable()
export class WebhookQueueService
  implements OnModuleDestroy
{
  private readonly queue: Queue;

  constructor(
    @Inject(REDIS)
    redis: Redis,
  ) {
    this.queue = new Queue(
      WEBHOOK_QUEUE_NAME,
      {
        connection: redis,
        defaultJobOptions: {
          removeOnComplete: 500,
          removeOnFail: 1000,
          attempts: 6,
          backoff: {
            type: "exponential",
            delay: 60_000,
          },
        },
      },
    );
  }

  async enqueue(deliveryId: string) {
    await this.queue.add(
      "deliver",
      { deliveryId },
      { jobId: deliveryId },
    );
  }

  async onModuleDestroy() {
    await this.queue.close();
  }
}
