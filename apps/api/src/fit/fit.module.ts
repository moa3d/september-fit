import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { FitController } from "./fit.controller";
import { FitService } from "./fit.service";
import { WebhooksModule } from "../webhooks/webhooks.module";
import { CommercialModule } from "../commercial/commercial.module";

@Module({
  imports: [AuthModule, WebhooksModule, CommercialModule],
  controllers: [FitController],
  providers: [FitService],
  exports: [FitService],
})
export class FitModule {}
