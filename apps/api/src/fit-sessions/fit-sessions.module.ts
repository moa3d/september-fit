import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { FitSessionsController } from "./fit-sessions.controller";
import { FitSessionsService } from "./fit-sessions.service";
import { WebhooksModule } from "../webhooks/webhooks.module";
import { CommercialModule } from "../commercial/commercial.module";

@Module({
  imports: [AuthModule, WebhooksModule, CommercialModule],
  controllers: [FitSessionsController],
  providers: [FitSessionsService],
  exports: [FitSessionsService],
})
export class FitSessionsModule {}
