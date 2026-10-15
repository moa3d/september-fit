import { Module } from "@nestjs/common";
import { WebhookEventsService } from "./webhook-events.service";
import { WebhookWorkerService } from "./webhook-worker.service";
import { WebhookQueueService } from "./webhook-queue.service";

@Module({
  providers: [WebhookEventsService, WebhookWorkerService, WebhookQueueService],
  exports: [WebhookEventsService, WebhookQueueService],
})
export class WebhooksModule {}
