import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { WebhooksModule } from "../webhooks/webhooks.module";
import { FeedbackController } from "./feedback.controller";
import { PublicFeedbackController } from "./public-feedback.controller";
import { FeedbackService } from "./feedback.service";

@Module({
  imports: [AuthModule, WebhooksModule],
  controllers: [
    FeedbackController,
    PublicFeedbackController,
  ],
  providers: [FeedbackService],
  exports: [FeedbackService],
})
export class FeedbackModule {}
