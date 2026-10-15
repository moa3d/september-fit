import { Module } from "@nestjs/common";
import { FitModule } from "../fit/fit.module";
import { FitSessionsModule } from "../fit-sessions/fit-sessions.module";
import { PublicFitController } from "./public-fit.controller";
import { PublicFitService } from "./public-fit.service";
import { WebhooksModule } from "../webhooks/webhooks.module";

@Module({
  imports: [FitModule, FitSessionsModule, WebhooksModule],
  controllers: [PublicFitController],
  providers: [PublicFitService],
})
export class PublicFitModule {}
