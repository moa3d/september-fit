import { Module } from "@nestjs/common";
import { CommercialModule } from "../commercial/commercial.module";
import { MailerModule } from "../mailer/mailer.module";
import { MerchantAuthModule } from "../merchant-auth/merchant-auth.module";
import { AccountController } from "./account.controller";
import { AccountService } from "./account.service";

@Module({
  imports: [
    MerchantAuthModule,
    MailerModule,
    CommercialModule,
  ],
  controllers: [AccountController],
  providers: [AccountService],
})
export class AccountModule {}
