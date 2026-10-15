import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import {
  createHash,
  randomBytes,
} from "node:crypto";
import { Prisma } from "@prisma/client";
import {
  FitEngineError,
  calculateFit,
  type FitPreference,
} from "@september-fit/fit-engine";
import { MeteringService } from "../commercial/metering.service";
import { QuotaService } from "../commercial/quota.service";
import { PrismaService } from "../prisma/prisma.service";
import { WebhookEventsService } from "../webhooks/webhook-events.service";
import { mapGarment, mapProfile } from "./fit.mapper";
import type { CalculateFitDto } from "./dto/calculate-fit.dto";

function toPrismaJson(
  value: unknown,
): Prisma.InputJsonValue {
  return JSON.parse(
    JSON.stringify(value),
  ) as Prisma.InputJsonValue;
}


@Injectable()
export class FitService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly webhooks: WebhookEventsService,
    private readonly quotas: QuotaService,
    private readonly metering: MeteringService,
  ) {}

  async calculate(
    merchantId: string,
    dto: CalculateFitDto,
  ) {
    const [product, profile] =
      await Promise.all([
        this.prisma.product.findFirst({
          where: {
            publicId: dto.product_id,
            merchantId,
            active: true,
          },
          include: {
            measurements: {
              where: { active: true },
              orderBy: {
                version: "desc",
              },
              take: 1,
            },
          },
        }),
        this.prisma.fitProfile.findFirst({
          where: {
            publicId: dto.profile_id,
            merchantId,
          },
        }),
      ]);

    if (!product) {
      throw new NotFoundException(
        "Product not found for this merchant.",
      );
    }

    if (!profile) {
      throw new NotFoundException(
        "Fit profile not found for this merchant.",
      );
    }

    const measurement =
      product.measurements[0];

    if (!measurement) {
      throw new ConflictException(
        "Product does not have active garment measurements.",
      );
    }

    let session: any = null;

    if (dto.session_id) {
      session =
        await this.prisma.fitSession.findFirst({
          where: {
            publicId: dto.session_id,
            merchantId,
            productId: product.id,
          },
          include: {
            result: true,
          },
        });

      if (!session) {
        throw new NotFoundException(
          "Fit session not found for this merchant and product.",
        );
      }

      if (session.expiresAt <= new Date()) {
        throw new ConflictException(
          "Fit session has expired.",
        );
      }

      if (session.result) {
        return this.serializeStoredResult(
          session.result,
          session.publicId,
          product.publicId,
          profile.publicId,
        );
      }
    }

    await this.quotas.assertMetricAvailable(
      merchantId,
      "FIT_CALCULATION",
    );

    const engineProfile = mapProfile(
      profile,
      dto.preferred_fit_override as
        | FitPreference
        | undefined,
    );

    const engineGarment = mapGarment(
      product,
      measurement,
    );

    let result;

    try {
      result = calculateFit(
        engineProfile,
        engineGarment,
      );
    } catch (error) {
      if (
        error instanceof FitEngineError
      ) {
        const fitError = error as {
          code: string;
          message: string;
          details?: unknown;
        };

        throw new UnprocessableEntityException({
          code: fitError.code,
          message: fitError.message,
          details:
            fitError.details ?? null,
        });
      }

      throw error;
    }

    if (!session) {
      const token = randomBytes(32).toString(
        "base64url",
      );

      session =
        await this.prisma.fitSession.create({
          data: {
            merchantId,
            productId: product.id,
            fitProfileId: profile.id,
            customerId:
              profile.customerId,
            status: "READY",
            publicTokenHash: createHash(
              "sha256",
            )
              .update(token)
              .digest("hex"),
            locale: "ar",
            expiresAt: new Date(
              Date.now() +
                30 * 60 * 1000,
            ),
          },
        });
    }

    let stored: {
      publicId: string;
      createdAt: Date;
    };

    try {
      stored =
      await this.prisma.$transaction(
        async (tx) => {
          const fitResult =
            await tx.fitResult.create({
              data: {
                merchantId,
                fitSessionId:
                  session.id,
                fitProfileId:
                  profile.id,
                productId: product.id,
                score: result.fitScore,
                label: result.label,
                confidence:
                  result.confidence,
                predictedFit:
                  result.predictedFit,
                engineVersion:
                  result.engineVersion,
                details: toPrismaJson({
                  coverage:
                    result.coverage,
                  confidenceScore:
                    result.confidenceScore,
                  metrics:
                    result.metrics,
                  warnings:
                    result.warnings,
                }),
                inputSnapshot:
                  toPrismaJson(
                    result.inputSnapshot,
                  ),
              },
            });

          await tx.fitSession.update({
            where: {
              id: session.id,
            },
            data: {
              status: "CALCULATED",
              fitProfileId:
                profile.id,
            },
          });

          await tx.analyticsEvent.create({
            data: {
              merchantId,
              eventType:
                "fit.calculated",
              customerId:
                profile.customerId,
              productId: product.id,
              sessionId: session.id,
              properties: {
                fitScore:
                  result.fitScore,
                label: result.label,
                confidence:
                  result.confidence,
                engineVersion:
                  result.engineVersion,
              },
            },
          });

          return fitResult;
        },
      );
    } catch (error) {
      if (
        dto.session_id &&
        error instanceof
          Prisma.PrismaClientKnownRequestError &&
        (error as { code?: string }).code ===
          "P2002"
      ) {
        const existing =
          await this.prisma.fitResult.findUnique({
            where: {
              fitSessionId: session.id,
            },
          });

        if (existing) {
          return this.serializeStoredResult(
            existing,
            session.publicId,
            product.publicId,
            profile.publicId,
          );
        }
      }

      throw error;
    }

    await this.metering.record(
      merchantId,
      "FIT_CALCULATION",
    );

    await this.webhooks.emit(
      merchantId,
      "fit.completed",
      {
        result_id: stored.publicId,
        session_id:
          session.publicId,
        product_id:
          product.publicId,
        profile_id:
          profile.publicId,
        fit_score:
          result.fitScore,
        label: result.label,
        confidence:
          result.confidence,
        engine_version:
          result.engineVersion,
      },
    );

    if (result.confidence === "HIGH") {
      await this.webhooks.emit(
        merchantId,
        "fit.high_confidence",
        {
          result_id:
            stored.publicId,
          session_id:
            session.publicId,
          product_id:
            product.publicId,
          fit_score:
            result.fitScore,
          label: result.label,
        },
      );
    }

    return {
      id: stored.publicId,
      session_id:
        session.publicId,
      product_id:
        product.publicId,
      profile_id:
        profile.publicId,
      fit_score:
        result.fitScore,
      label: result.label,
      label_ar:
        this.labelAr(result.label),
      confidence:
        result.confidence,
      confidence_score:
        result.confidenceScore,
      predicted_fit:
        result.predictedFit,
      engine_version:
        result.engineVersion,
      coverage: result.coverage,
      details: result.metrics,
      warnings: result.warnings,
      created_at: stored.createdAt,
    };
  }

  private serializeStoredResult(
    result: {
      publicId: string;
      score: number;
      label: string;
      confidence: string;
      predictedFit: string | null;
      engineVersion: string;
      details: unknown;
      createdAt: Date;
    },
    sessionPublicId: string,
    productPublicId: string,
    profilePublicId: string,
  ) {
    const stored = this.unpackStoredDetails(
      result.details,
    );

    return {
      id: result.publicId,
      session_id: sessionPublicId,
      product_id: productPublicId,
      profile_id: profilePublicId,
      fit_score: result.score,
      label: result.label,
      label_ar:
        this.labelAr(result.label),
      confidence:
        result.confidence,
      confidence_score:
        stored.confidenceScore,
      predicted_fit:
        result.predictedFit,
      engine_version:
        result.engineVersion,
      coverage: stored.coverage,
      details: stored.metrics,
      warnings: stored.warnings,
      created_at:
        result.createdAt,
    };
  }

  private unpackStoredDetails(
    value: unknown,
  ): {
    coverage?: number;
    confidenceScore?: number;
    metrics: Record<string, unknown>;
    warnings: string[];
  } {
    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value)
    ) {
      return {
        metrics: {},
        warnings: [],
      };
    }

    const object = value as Record<
      string,
      unknown
    >;

    const metrics =
      object.metrics &&
      typeof object.metrics === "object" &&
      !Array.isArray(object.metrics)
        ? (object.metrics as Record<
            string,
            unknown
          >)
        : object;

    return {
      coverage:
        typeof object.coverage === "number"
          ? object.coverage
          : undefined,
      confidenceScore:
        typeof object.confidenceScore ===
        "number"
          ? object.confidenceScore
          : undefined,
      metrics,
      warnings: Array.isArray(
        object.warnings,
      )
        ? object.warnings.filter(
            (item): item is string =>
              typeof item === "string",
          )
        : [],
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
}
