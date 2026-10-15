import {
  Global,
  Module,
} from "@nestjs/common";
import { MerchantAuthModule } from "../merchant-auth/merchant-auth.module";
import { CommercialController } from "./commercial.controller";
import { MeteringService } from "./metering.service";
import { OnboardingService } from "./onboarding.service";
import { QuotaService } from "./quota.service";
import { SubscriptionService } from "./subscription.service";
import { StripeBillingService } from "./stripe-billing.service";

@Global()
@Module({
  imports: [MerchantAuthModule],
  controllers: [CommercialController],
  providers: [
    SubscriptionService,
    QuotaService,
    MeteringService,
    OnboardingService,
    StripeBillingService,
  ],
  exports: [
    SubscriptionService,
    QuotaService,
    MeteringService,
    OnboardingService,
    StripeBillingService,
  ],
})
export class CommercialModule {}
