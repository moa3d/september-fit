import { ConflictException, Injectable } from "@nestjs/common";
import { FitService } from "../fit/fit.service";
import { FitSessionsService } from "../fit-sessions/fit-sessions.service";
import { PrismaService } from "../prisma/prisma.service";
import { WebhookEventsService } from "../webhooks/webhook-events.service";
import type { PublicProfileDto } from "./dto/public-profile.dto";

@Injectable()
export class PublicFitService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: FitSessionsService,
    private readonly fit: FitService,
    private readonly webhooks: WebhookEventsService,
  ) {}

  async getSession(token: string) {
    const session = await this.sessions.resolvePublicToken(token);

    return {
      session_id: session.publicId,
      status: session.status,
      merchant: {
        name: session.merchant.name,
      },
      product: {
        id: session.product.publicId,
        name: session.product.name,
        brand: session.product.brand,
        category: session.product.category,
        original_size_label: session.product.originalSizeLabel,
        measurement_quality:
          session.product.measurements[0]?.quality ?? null,
      },
      has_profile: Boolean(session.fitProfile),
      result: session.result
        ? this.serializeStoredResult(
            session.result,
          )
        : null,
      return_url: session.returnUrl,
      locale: session.locale,
      expires_at: session.expiresAt,
    };
  }

  async embedPolicy(
    token: string,
    parentOrigin: string,
  ) {
    return this.sessions.checkEmbedOrigin(
      token,
      parentOrigin,
    );
  }

  async saveProfile(token: string, dto: PublicProfileDto) {
    const session = await this.sessions.resolvePublicToken(token);

    let profile;

    if (
      session.fitProfile &&
      !session.fitProfile.merchantCanReadMeasurements
    ) {
      profile = await this.prisma.fitProfile.update({
        where: { id: session.fitProfile.id },
        data: {
          profileType: dto.profile_type,
          preferredFit: dto.preferred_fit,
          heightCm: dto.height_cm ?? session.fitProfile.heightCm,
          weightKg: dto.weight_kg ?? session.fitProfile.weightKg,
          chestCm: dto.chest_cm ?? session.fitProfile.chestCm,
          waistCm: dto.waist_cm ?? session.fitProfile.waistCm,
          hipsCm: dto.hips_cm ?? session.fitProfile.hipsCm,
          shoulderCm: dto.shoulder_cm ?? session.fitProfile.shoulderCm,
          sleeveCm: dto.sleeve_cm ?? session.fitProfile.sleeveCm,
          inseamCm: dto.inseam_cm ?? session.fitProfile.inseamCm,
          thighCm: dto.thigh_cm ?? session.fitProfile.thighCm,
          version: { increment: 1 },
        },
      });
    } else {
      profile = await this.prisma.fitProfile.create({
        data: {
          merchantId: session.merchantId,
          customerId: session.customerId,
          profileType: dto.profile_type,
          preferredFit: dto.preferred_fit,
          merchantCanReadMeasurements: false,
          heightCm: dto.height_cm ?? null,
          weightKg: dto.weight_kg ?? null,
          chestCm: dto.chest_cm ?? null,
          waistCm: dto.waist_cm ?? null,
          hipsCm: dto.hips_cm ?? null,
          shoulderCm: dto.shoulder_cm ?? null,
          sleeveCm: dto.sleeve_cm ?? null,
          inseamCm: dto.inseam_cm ?? null,
          thighCm: dto.thigh_cm ?? null,
        },
      });
    }

    if (session.result) {
      const linkedFeedback =
        await this.prisma.fitFeedback.count({
          where: {
            fitResultId: session.result.id,
          },
        });

      const linkedFeedbackRequests =
        await this.prisma.feedbackRequest.count({
          where: {
            fitResultId: session.result.id,
          },
        });

      if (
        linkedFeedback > 0 ||
        linkedFeedbackRequests > 0
      ) {
        throw new ConflictException(
          "This Fit result is already linked to post-purchase feedback and cannot be recalculated.",
        );
      }

      await this.prisma.fitResult.delete({
        where: { id: session.result.id },
      });
    }

    await this.prisma.fitSession.update({
      where: { id: session.id },
      data: {
        fitProfileId: profile.id,
        status: "READY",
      },
    });

    await this.prisma.analyticsEvent.create({
      data: {
        merchantId: session.merchantId,
        eventType: "profile.updated",
        customerId: session.customerId,
        productId: session.productId,
        sessionId: session.id,
        properties: {
          profilePublicId: profile.publicId,
          source: "hosted_session",
        },
      },
    });

    await this.webhooks.emit(session.merchantId, "profile.updated", {
      profile_id: profile.publicId,
      session_id: session.publicId,
      source: "hosted_session",
      version: profile.version,
    });

    return {
      profile_id: profile.publicId,
      session_id: session.publicId,
      status: "READY",
    };
  }

  async calculate(token: string) {
    const session = await this.sessions.resolvePublicToken(token);

    if (!session.fitProfile) {
      return {
        status: "PROFILE_REQUIRED",
        session_id: session.publicId,
      };
    }

    const result = await this.fit.calculate(session.merchantId, {
      product_id: session.product.publicId,
      profile_id: session.fitProfile.publicId,
      session_id: session.publicId,
    });

    return {
      status: "CALCULATED",
      session_id: session.publicId,
      result,
      return_url: session.returnUrl,
    };
  }

  private labelAr(label: string) {
    const labels: Record<string, string> = {
      EXCELLENT: "مناسبة لك جدًا",
      GOOD: "مناسبة لك",
      POSSIBLE: "قد تناسبك",
      NOT_IDEAL: "غير مثالية",
      NOT_RECOMMENDED: "لا ننصح بها",
    };

    return labels[label] ?? label;
  }

  private serializeStoredResult(result: {
    publicId: string;
    score: number;
    label: string;
    confidence: string;
    predictedFit: string | null;
    engineVersion: string;
    details: unknown;
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
      label_ar: this.labelAr(result.label),
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
    };
  }
}
