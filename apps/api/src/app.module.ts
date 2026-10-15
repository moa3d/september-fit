import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { FitModule } from "./fit/fit.module";
import { HealthModule } from "./health/health.module";
import { ProductsModule } from "./products/products.module";
import { ProfilesModule } from "./profiles/profiles.module";
import { FitSessionsModule } from "./fit-sessions/fit-sessions.module";
import { PublicFitModule } from "./public-fit/public-fit.module";
import { DeveloperModule } from "./developer/developer.module";
import { IdempotencyModule } from "./idempotency/idempotency.module";
import { WebhooksModule } from "./webhooks/webhooks.module";
import { MerchantAuthModule } from "./merchant-auth/merchant-auth.module";
import { FeedbackModule } from "./feedback/feedback.module";
import { SecurityModule } from "./security/security.module";
import { RateLimitModule } from "./rate-limit/rate-limit.module";
import { RequestLogsModule } from "./request-logs/request-logs.module";
import { CommercialModule } from "./commercial/commercial.module";
import { MailerModule } from "./mailer/mailer.module";
import { AccountModule } from "./account/account.module";
import { RedisModule } from "./redis/redis.module";
import { PrivacyModule } from "./privacy/privacy.module";
import { MaintenanceModule } from "./maintenance/maintenance.module";
import { ConfigValidationModule } from "./config/config-validation.module";
import { StructuredLoggerMiddleware } from "./logging/structured-logger.middleware";

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    HealthModule,
    ProductsModule,
    ProfilesModule,
    FitSessionsModule,
    FitModule,
    PublicFitModule,
    DeveloperModule,
    IdempotencyModule,
    WebhooksModule,
    MerchantAuthModule,
    FeedbackModule,
    SecurityModule,
    RateLimitModule,
    RequestLogsModule,
    CommercialModule,
    MailerModule,
    AccountModule,
    RedisModule,
    PrivacyModule,
    MaintenanceModule,
    ConfigValidationModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(StructuredLoggerMiddleware)
      .forRoutes("*");
  }
}
