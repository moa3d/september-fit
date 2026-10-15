import { Module } from "@nestjs/common";
import { MerchantAuthModule } from "../merchant-auth/merchant-auth.module";
import { DeveloperController } from "./developer.controller";
import { DeveloperService } from "./developer.service";
import { FeedbackModule } from "../feedback/feedback.module";
import { CommercialModule } from "../commercial/commercial.module";
import { ProductsModule } from "../products/products.module";
import { FitSessionsModule } from "../fit-sessions/fit-sessions.module";

@Module({
  imports: [
    MerchantAuthModule,
    FeedbackModule,
    CommercialModule,
    ProductsModule,
    FitSessionsModule,
  ],
  controllers: [DeveloperController],
  providers: [DeveloperService],
})
export class DeveloperModule {}
