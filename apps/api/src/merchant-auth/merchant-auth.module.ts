import { Module } from "@nestjs/common";
import { MerchantAuthController } from "./merchant-auth.controller";
import { MerchantAuthService } from "./merchant-auth.service";
import { MerchantSessionService } from "./merchant-session.service";
import { MerchantSessionGuard } from "./merchant-session.guard";
import { MerchantRolesGuard } from "./merchant-roles";
import { SecurityModule } from "../security/security.module";

@Module({
  imports: [SecurityModule],
  controllers: [MerchantAuthController],
  providers: [
    MerchantAuthService,
    MerchantSessionService,
    MerchantSessionGuard,
    MerchantRolesGuard,
  ],
  exports: [
    MerchantSessionService,
    MerchantSessionGuard,
    MerchantRolesGuard,
  ],
})
export class MerchantAuthModule {}
