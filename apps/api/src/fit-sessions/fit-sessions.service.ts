import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  createHash,
  randomBytes,
} from "node:crypto";
import { MeteringService } from "../commercial/metering.service";
import { QuotaService } from "../commercial/quota.service";
import { PrismaService } from "../prisma/prisma.service";
import { WebhookEventsService } from "../webhooks/webhook-events.service";
import type { CreateFitSessionDto } from "./dto/create-fit-session.dto";

@Injectable()
export class FitSessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly webhooks: WebhookEventsService,
    private readonly quotas: QuotaService,
    private readonly metering: MeteringService,
  ) {}

  async create(
    merchantId: string,
    dto: CreateFitSessionDto,
  ) {
    const product =
      await this.prisma.product.findFirst({
        where: {
          merchantId,
          externalProductId:
            dto.external_product_id,
          active: true,
        },
      });

    if (!product) {
      throw new NotFoundException(
        "Product with this external_product_id was not found for this merchant.",
      );
    }

    await this.quotas.assertMetricAvailable(
      merchantId,
      "FIT_SESSION",
    );

    if (dto.return_url) {
      await this.assertAllowedReturnUrl(
        merchantId,
        dto.return_url,
      );
    }

    const customer =
      dto.external_customer_id
        ? await this.prisma.customer.upsert({
            where: {
              merchantId_externalCustomerId: {
                merchantId,
                externalCustomerId:
                  dto.external_customer_id,
              },
            },
            update: {},
            create: {
              merchantId,
              externalCustomerId:
                dto.external_customer_id,
            },
          })
        : null;

    let profile = null;

    if (dto.profile_id) {
      profile =
        await this.prisma.fitProfile.findFirst({
          where: {
            merchantId,
            publicId: dto.profile_id,
          },
        });

      if (!profile) {
        throw new NotFoundException(
          "Fit profile was not found for this merchant.",
        );
      }

      if (
        customer &&
        profile.customerId &&
        profile.customerId !== customer.id
      ) {
        throw new BadRequestException(
          "profile_id does not belong to external_customer_id.",
        );
      }
    }

    const rawToken = `fs_${randomBytes(32).toString("base64url")}`;
    const tokenHash = createHash("sha256")
      .update(rawToken)
      .digest("hex");
    const expiresAt = new Date(
      Date.now() + 30 * 60 * 1000,
    );

    const session =
      await this.prisma.fitSession.create({
        data: {
          merchantId,
          customerId:
            customer?.id ??
            profile?.customerId ??
            null,
          fitProfileId:
            profile?.id ?? null,
          productId: product.id,
          status: profile
            ? "READY"
            : "PROFILE_REQUIRED",
          publicTokenHash: tokenHash,
          returnUrl:
            dto.return_url ?? null,
          locale: dto.locale ?? "ar",
          expiresAt,
        },
      });

    await this.metering.record(
      merchantId,
      "FIT_SESSION",
    );

    await this.prisma.analyticsEvent.create({
      data: {
        merchantId,
        eventType: "fit.session.created",
        customerId: session.customerId,
        productId: product.id,
        sessionId: session.id,
        properties: {
          hasProfile: Boolean(profile),
          locale: session.locale,
        },
      },
    });

    await this.webhooks.emit(
      merchantId,
      "fit.session.created",
      {
        session_id: session.publicId,
        product_id: product.publicId,
        external_product_id:
          product.externalProductId,
        status: session.status,
        expires_at:
          session.expiresAt.toISOString(),
      },
    );

    const baseUrl = (
      process.env.FIT_WEB_BASE_URL ??
      "http://localhost:3001"
    ).replace(/\/+$/, "");

    return {
      session_id: session.publicId,
      fit_url: `${baseUrl}/s/${rawToken}`,
      status: session.status,
      expires_at: session.expiresAt,
    };
  }

  async list(merchantId: string) {
    const sessions = await this.prisma.fitSession.findMany({
      where: { merchantId },
      include: {
        product: true,
        result: true,
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    return {
      data: sessions.map((session) => ({
        id: session.publicId,
        status: this.effectiveStatus(
          session.status,
          session.expiresAt,
        ),
        product_id: session.product.publicId,
        external_product_id: session.product.externalProductId,
        product_name: session.product.name,
        result: session.result
          ? this.serializeStoredResult(session.result)
          : null,
        created_at: session.createdAt,
        expires_at: session.expiresAt,
      })),
    };
  }

  async get(
    merchantId: string,
    publicId: string,
  ) {
    const session =
      await this.prisma.fitSession.findFirst({
        where: {
          merchantId,
          publicId,
        },
        include: {
          product: true,
          fitProfile: true,
          result: true,
        },
      });

    if (!session) {
      throw new NotFoundException(
        "Fit session not found for this merchant.",
      );
    }

    return {
      id: session.publicId,
      status: this.effectiveStatus(
        session.status,
        session.expiresAt,
      ),
      product_id: session.product.publicId,
      profile_id:
        session.fitProfile?.publicId ?? null,
      result: session.result
        ? this.serializeStoredResult(
            session.result,
          )
        : null,
      return_url: session.returnUrl,
      created_at: session.createdAt,
      expires_at: session.expiresAt,
    };
  }

  async resolvePublicToken(rawToken: string) {
    const tokenHash = createHash("sha256")
      .update(rawToken)
      .digest("hex");

    const session =
      await this.prisma.fitSession.findUnique({
        where: {
          publicTokenHash: tokenHash,
        },
        include: {
          merchant: true,
          product: {
            include: {
              measurements: {
                where: { active: true },
                orderBy: {
                  version: "desc",
                },
                take: 1,
              },
            },
          },
          fitProfile: true,
          result: true,
        },
      });

    if (
      !session ||
      session.expiresAt <= new Date()
    ) {
      throw new NotFoundException(
        "Fit session is invalid or expired.",
      );
    }

    return session;
  }

  async checkEmbedOrigin(
    rawToken: string,
    parentOrigin: string,
  ) {
    const session =
      await this.resolvePublicToken(rawToken);

    let normalized: string;

    try {
      normalized =
        new URL(parentOrigin).origin;
    } catch {
      return {
        allowed: false,
        origin: null,
      };
    }

    const allowed =
      await this.prisma.allowedOrigin.findUnique({
        where: {
          merchantId_origin: {
            merchantId:
              session.merchantId,
            origin: normalized,
          },
        },
      });

    return {
      allowed: Boolean(allowed),
      origin: allowed
        ? normalized
        : null,
    };
  }

  private serializeStoredResult(result: {
    publicId: string;
    score: number;
    label: string;
    confidence: string;
    predictedFit: string | null;
    engineVersion: string;
    details: unknown;
    createdAt: Date;
  }) {
    const details =
      result.details &&
      typeof result.details === "object" &&
      !Array.isArray(result.details)
        ? (result.details as Record<
            string,
            unknown
          >)
        : {};

    const metrics =
      details.metrics &&
      typeof details.metrics === "object" &&
      !Array.isArray(details.metrics)
        ? (details.metrics as Record<
            string,
            unknown
          >)
        : details;

    return {
      id: result.publicId,
      fit_score: result.score,
      label: result.label,
      confidence: result.confidence,
      predicted_fit: result.predictedFit,
      engine_version: result.engineVersion,
      coverage:
        typeof details.coverage === "number"
          ? details.coverage
          : undefined,
      confidence_score:
        typeof details.confidenceScore ===
        "number"
          ? details.confidenceScore
          : undefined,
      details: metrics,
      warnings: Array.isArray(
        details.warnings,
      )
        ? details.warnings.filter(
            (item): item is string =>
              typeof item === "string",
          )
        : [],
      created_at: result.createdAt,
    };
  }

  private async assertAllowedReturnUrl(
    merchantId: string,
    returnUrl: string,
  ) {
    const parsed = new URL(returnUrl);

    const allowed =
      await this.prisma.allowedOrigin.findUnique({
        where: {
          merchantId_origin: {
            merchantId,
            origin: parsed.origin,
          },
        },
      });

    if (!allowed) {
      throw new BadRequestException(
        `return_url origin ${parsed.origin} is not registered for this merchant.`,
      );
    }
  }

  private effectiveStatus(
    status: string,
    expiresAt: Date,
  ) {
    return expiresAt <= new Date()
      ? "EXPIRED"
      : status;
  }
}
