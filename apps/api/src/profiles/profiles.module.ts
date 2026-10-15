import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ProfilesController } from "./profiles.controller";
import { ProfilesService } from "./profiles.service";
import { WebhooksModule } from "../webhooks/webhooks.module";

@Module({
  imports: [AuthModule, WebhooksModule],
  controllers: [ProfilesController],
  providers: [ProfilesService],
  exports: [ProfilesService],
})
export class ProfilesModule {}
