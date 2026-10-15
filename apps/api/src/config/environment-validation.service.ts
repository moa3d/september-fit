import {
  Injectable,
  Logger,
  OnModuleInit,
} from "@nestjs/common";

@Injectable()
export class EnvironmentValidationService
  implements OnModuleInit
{
  private readonly logger = new Logger(
    EnvironmentValidationService.name,
  );

  onModuleInit() {
    if (process.env.NODE_ENV !== "production") {
      return;
    }

    const required = [
      "DATABASE_URL",
      "REDIS_URL",
      "FIT_WEB_BASE_URL",
      "DASHBOARD_ORIGINS",
      "DASHBOARD_PUBLIC_URL",
      "WEBHOOK_SECRET_MASTER_KEY",
    ];

    const missing = required.filter(
      (key) => !process.env[key]?.trim(),
    );

    if (missing.length > 0) {
      throw new Error(
        `Missing required production environment variables: ${missing.join(", ")}`,
      );
    }

    this.requireHttps(
      "FIT_WEB_BASE_URL",
      process.env.FIT_WEB_BASE_URL!,
    );
    this.requireHttps(
      "DASHBOARD_PUBLIC_URL",
      process.env.DASHBOARD_PUBLIC_URL!,
    );

    const origins = process.env
      .DASHBOARD_ORIGINS!
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    if (
      origins.length === 0 ||
      origins.some(
        (origin) =>
          !origin.startsWith("https://"),
      )
    ) {
      throw new Error(
        "DASHBOARD_ORIGINS must contain HTTPS origins in production.",
      );
    }

    const masterKey = Buffer.from(
      process.env.WEBHOOK_SECRET_MASTER_KEY!,
      "base64",
    );

    if (masterKey.length !== 32) {
      throw new Error(
        "WEBHOOK_SECRET_MASTER_KEY must be a base64-encoded 32-byte key.",
      );
    }

    if (
      process.env.DASHBOARD_COOKIE_DOMAIN?.trim()
    ) {
      this.logger.warn(
        "DASHBOARD_COOKIE_DOMAIN is set. A host-only API session cookie is safer and is the recommended production configuration.",
      );
    }

    if (
      !process.env.STRIPE_SECRET_KEY ||
      !process.env.STRIPE_WEBHOOK_SECRET
    ) {
      this.logger.warn(
        "Stripe live billing is not fully configured; paid checkout/webhooks will remain unavailable.",
      );
    }

    if (
      !process.env.EMAIL_PROVIDER ||
      process.env.EMAIL_PROVIDER === "console"
    ) {
      this.logger.warn(
        "Transactional email is not configured for production; invitations and password-reset delivery require a real provider adapter.",
      );
    }
  }

  private requireHttps(
    key: string,
    value: string,
  ) {
    let url: URL;

    try {
      url = new URL(value);
    } catch {
      throw new Error(
        `${key} must be a valid URL.`,
      );
    }

    if (url.protocol !== "https:") {
      throw new Error(
        `${key} must use HTTPS in production.`,
      );
    }
  }
}
