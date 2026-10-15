import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomBytes, createHash } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { generateApiKey, hashSecret } from "../auth/api-key.crypto";
import { encryptWebhookSecret } from "../webhooks/crypto/webhook-secret.crypto";
import { QuotaService } from "../commercial/quota.service";
import type { CreateApiKeyDto } from "./dto/create-api-key.dto";
import type { CreateOriginDto } from "./dto/create-origin.dto";
import type { CreateWebhookDto } from "./dto/create-webhook.dto";

const ALLOWED_SCOPES = new Set([
  "products:read",
  "products:write",
  "profiles:read",
  "profiles:write",
  "fit:calculate",
  "sessions:write",
  "feedback:write",
  "analytics:read",
  "webhooks:manage",
]);

const ALLOWED_WEBHOOK_EVENTS = new Set([
  "fit.session.created",
  "fit.completed",
  "fit.high_confidence",
  "profile.updated",
  "feedback.received",
]);

@Injectable()
export class DeveloperService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly quotas: QuotaService,
  ) {}

  async overview(merchantId: string) {
    const [
      apiKeys,
      origins,
      webhooks,
      products,
      sessions,
      results,
      feedback,
    ] = await Promise.all([
      this.prisma.apiKey.count({
        where: { merchantId, revokedAt: null },
      }),
      this.prisma.allowedOrigin.count({ where: { merchantId } }),
      this.prisma.webhookEndpoint.count({
        where: { merchantId, enabled: true },
      }),
      this.prisma.product.count({
        where: { merchantId, active: true },
      }),
      this.prisma.fitSession.count({ where: { merchantId } }),
      this.prisma.fitResult.count({ where: { merchantId } }),
      this.prisma.fitFeedback.count({ where: { merchantId } }),
    ]);

    return {
      api_keys: apiKeys,
      allowed_origins: origins,
      active_webhooks: webhooks,
      active_products: products,
      fit_sessions: sessions,
      fit_results: results,
      feedback_count: feedback,
    };
  }

  async listApiKeys(merchantId: string) {
    const keys = await this.prisma.apiKey.findMany({
      where: { merchantId },
      orderBy: { createdAt: "desc" },
    });

    return {
      data: keys.map((key) => ({
        id: key.id,
        name: key.name,
        environment: key.environment,
        prefix: key.prefix,
        last_four: key.lastFour,
        scopes: key.scopes,
        last_used_at: key.lastUsedAt,
        expires_at: key.expiresAt,
        revoked_at: key.revokedAt,
        created_at: key.createdAt,
      })),
    };
  }

  async createApiKey(merchantId: string, dto: CreateApiKeyDto) {
    await this.quotas.assertResourceAvailable(
      merchantId,
      "API_KEYS",
    );

    const invalid = dto.scopes.filter((s) => !ALLOWED_SCOPES.has(s));
    if (invalid.length) {
      throw new BadRequestException(
        `Unsupported scope(s): ${invalid.join(", ")}`,
      );
    }

    const generated = generateApiKey(dto.environment ?? "TEST");

    const key = await this.prisma.apiKey.create({
      data: {
        merchantId,
        environment: dto.environment ?? "TEST",
        name: dto.name,
        prefix: generated.prefix,
        lastFour: generated.lastFour,
        secretHash: generated.secretHash,
        scopes: [...new Set(dto.scopes)],
      },
    });

    await this.prisma.auditLog.create({
      data: {
        merchantId,
        actorType: "merchant_user",
        action: "api_key.created",
        objectType: "api_key",
        objectId: key.id,
        metadata: {
          environment: key.environment,
          scopes: key.scopes,
        },
      },
    });

    return {
      id: key.id,
      name: key.name,
      environment: key.environment,
      scopes: key.scopes,
      secret_key: generated.raw,
      warning:
        "This secret is returned once. Store it securely; it cannot be recovered later.",
      created_at: key.createdAt,
    };
  }

  async revokeApiKey(merchantId: string, id: string) {
    const key = await this.prisma.apiKey.findFirst({
      where: { id, merchantId },
    });

    if (!key) {
      throw new NotFoundException("API key not found.");
    }

    if (!key.revokedAt) {
      await this.prisma.apiKey.update({
        where: { id: key.id },
        data: { revokedAt: new Date() },
      });

      await this.prisma.auditLog.create({
        data: {
          merchantId,
          actorType: "merchant_user",
          action: "api_key.revoked",
          objectType: "api_key",
          objectId: key.id,
        },
      });
    }

    return { id: key.id, revoked: true };
  }

  async listOrigins(merchantId: string) {
    const origins = await this.prisma.allowedOrigin.findMany({
      where: { merchantId },
      orderBy: { createdAt: "desc" },
    });

    return {
      data: origins.map((o) => ({
        id: o.id,
        origin: o.origin,
        created_at: o.createdAt,
      })),
    };
  }

  async createOrigin(merchantId: string, dto: CreateOriginDto) {
    const parsed = new URL(dto.origin);
    const normalized = parsed.origin;

    const origin = await this.prisma.allowedOrigin.upsert({
      where: {
        merchantId_origin: {
          merchantId,
          origin: normalized,
        },
      },
      update: {},
      create: {
        merchantId,
        origin: normalized,
      },
    });

    return {
      id: origin.id,
      origin: origin.origin,
      created_at: origin.createdAt,
    };
  }

  async deleteOrigin(merchantId: string, id: string) {
    const origin = await this.prisma.allowedOrigin.findFirst({
      where: { id, merchantId },
    });

    if (!origin) {
      throw new NotFoundException("Allowed origin not found.");
    }

    await this.prisma.allowedOrigin.delete({ where: { id: origin.id } });

    return { id: origin.id, deleted: true };
  }

  async listWebhooks(merchantId: string) {
    const hooks = await this.prisma.webhookEndpoint.findMany({
      where: { merchantId },
      orderBy: { createdAt: "desc" },
    });

    return {
      data: hooks.map((hook) => ({
        id: hook.publicId,
        url: hook.url,
        environment: hook.environment,
        events: hook.events,
        enabled: hook.enabled,
        secret_prefix: hook.secretPrefix,
        created_at: hook.createdAt,
      })),
    };
  }

  async createWebhook(merchantId: string, dto: CreateWebhookDto) {
    await this.quotas.assertResourceAvailable(
      merchantId,
      "WEBHOOKS",
    );

    const invalid = dto.events.filter(
      (event) => !ALLOWED_WEBHOOK_EVENTS.has(event),
    );

    if (invalid.length) {
      throw new BadRequestException(
        `Unsupported webhook event(s): ${invalid.join(", ")}`,
      );
    }

    const rawSecret = `whsec_${dto.environment.toLowerCase()}_${randomBytes(24).toString("base64url")}`;
    const encrypted = encryptWebhookSecret(rawSecret);

    const hook = await this.prisma.webhookEndpoint.create({
      data: {
        merchantId,
        environment: dto.environment,
        url: dto.url,
        secretHash: hashSecret(rawSecret),
        secretPrefix: rawSecret.slice(0, 18),
        secretCiphertext: encrypted.ciphertext,
        secretIv: encrypted.iv,
        secretTag: encrypted.tag,
        events: [...new Set(dto.events)],
        enabled: true,
      },
    });

    return {
      id: hook.publicId,
      url: hook.url,
      environment: hook.environment,
      events: hook.events,
      signing_secret: rawSecret,
      warning:
        "The webhook signing secret is returned once. Store it securely.",
      created_at: hook.createdAt,
    };
  }

  async disableWebhook(merchantId: string, publicId: string) {
    const hook = await this.prisma.webhookEndpoint.findFirst({
      where: { merchantId, publicId },
    });

    if (!hook) {
      throw new NotFoundException("Webhook endpoint not found.");
    }

    await this.prisma.webhookEndpoint.update({
      where: { id: hook.id },
      data: { enabled: false },
    });

    return { id: hook.publicId, enabled: false };
  }

  async listWebhookDeliveries(merchantId: string) {
    const deliveries = await this.prisma.webhookDelivery.findMany({
      where: { merchantId },
      include: {
        endpoint: true,
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return {
      data: deliveries.map((delivery) => ({
        id: delivery.id,
        event_id: delivery.eventId,
        event_type: delivery.eventType,
        url: delivery.endpoint.url,
        status: delivery.status,
        attempt_count: delivery.attemptCount,
        last_response_code: delivery.lastResponseCode,
        next_attempt_at: delivery.nextAttemptAt,
        delivered_at: delivery.deliveredAt,
        created_at: delivery.createdAt,
      })),
    };
  }

  async listRequestLogs(
    merchantId: string,
    limit = 100,
  ) {
    const rows =
      await this.prisma.apiRequestLog.findMany({
        where: { merchantId },
        orderBy: { createdAt: "desc" },
        take: Math.min(
          Math.max(limit, 1),
          200,
        ),
      });

    return {
      data: rows.map((row) => ({
        request_id: row.requestId,
        method: row.method,
        route: row.route,
        status_code: row.statusCode,
        duration_ms: row.durationMs,
        error_code: row.errorCode,
        auth_kind: row.authKind,
        created_at: row.createdAt,
      })),
    };
  }

  async listLogs(
    merchantId: string,
    options?: { limit?: number; event_type?: string },
  ) {
    const limit = Math.min(Math.max(options?.limit ?? 50, 1), 100);

    const events = await this.prisma.analyticsEvent.findMany({
      where: {
        merchantId,
        ...(options?.event_type
          ? { eventType: options.event_type }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return {
      data: events.map((event) => ({
        id: event.id,
        event_type: event.eventType,
        customer_id: event.customerId,
        product_id: event.productId,
        session_id: event.sessionId,
        properties: event.properties,
        created_at: event.createdAt,
      })),
    };
  }
}
