import { Module } from "@nestjs/common";
import { MerchantAuthModule } from "../merchant-auth/merchant-auth.module";
import { DeveloperController } from "./developer.controller";
import { DeveloperService } from "./developer.service";
import { FeedbackModule } from "../feedback/feedback.module";
import { CommercialModule } from "../commercial/commercial.module";

@Module({
  imports: [MerchantAuthModule, FeedbackModule, CommercialModule],
  controllers: [DeveloperController],
  providers: [DeveloperService],
})
export class DeveloperModule {}
