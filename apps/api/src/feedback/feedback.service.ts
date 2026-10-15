import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { createHash, randomBytes } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { WebhookEventsService } from "../webhooks/webhook-events.service";
import type { CreateFeedbackRequestDto } from "./dto/create-feedback-request.dto";
import type { SubmitFeedbackDto } from "./dto/submit-feedback.dto";

const ALLOWED_PROBLEM_AREAS = new Set([
  "CHEST",
  "SHOULDER",
  "WAIST",
  "HIPS",
  "LENGTH",
  "SLEEVE",
  "THIGH",
  "INSEAM",
]);

@Injectable()
export class FeedbackService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly webhooks: WebhookEventsService,
  ) {}

  async createRequest(
    merchantId: string,
    dto: CreateFeedbackRequestDto,
  ) {
    if (!dto.session_id && !dto.result_id) {
      throw new BadRequestException(
        "session_id or result_id is required.",
      );
    }

    let result = dto.result_id
      ? await this.prisma.fitResult.findFirst({
          where: {
            merchantId,
            publicId: dto.result_id,
          },
          include: {
            fitSession: true,
            product: true,
          },
        })
      : null;

    let session = dto.session_id
      ? await this.prisma.fitSession.findFirst({
          where: {
            merchantId,
            publicId: dto.session_id,
          },
          include: {
            product: true,
            result: true,
          },
        })
      : null;

    if (!result && session?.result) {
      result = await this.prisma.fitResult.findUnique({
        where: { id: session.result.id },
        include: {
          fitSession: true,
          product: true,
        },
      });
    }

    if (!session && result) {
      session = await this.prisma.fitSession.findUnique({
        where: { id: result.fitSessionId },
        include: {
          product: true,
          result: true,
        },
      });
    }

    if (!session) {
      throw new NotFoundException(
        "Fit session was not found for this merchant.",
      );
    }

    if (!result) {
      throw new ConflictException(
        "Feedback can be requested only after a Fit result exists.",
      );
    }

    if (dto.return_url) {
      await this.assertAllowedReturnUrl(
        merchantId,
        dto.return_url,
      );
    }

    const activeExisting =
      await this.prisma.feedbackRequest.findFirst({
        where: {
          merchantId,
          fitResultId: result.id,
          status: "CREATED",
          expiresAt: { gt: new Date() },
        },
      });

    if (activeExisting) {
      return {
        request_id: activeExisting.publicId,
        feedback_url: null,
        status: activeExisting.status,
        expires_at: activeExisting.expiresAt,
        message:
          "An active feedback request already exists. Create a fresh request only after it expires or is cancelled.",
      };
    }

    const rawToken = `fb_${randomBytes(32).toString("base64url")}`;
    const tokenHash = createHash("sha256")
      .update(rawToken)
      .digest("hex");

    const expiresAt = new Date(
      Date.now() + 30 * 24 * 60 * 60 * 1000,
    );

    const request =
      await this.prisma.feedbackRequest.create({
        data: {
          merchantId,
          customerId: session.customerId,
          productId: session.productId,
          fitSessionId: session.id,
          fitResultId: result.id,
          externalOrderId:
            dto.external_order_id ?? null,
          publicTokenHash: tokenHash,
          returnUrl: dto.return_url ?? null,
          expiresAt,
        },
      });

    await this.prisma.analyticsEvent.create({
      data: {
        merchantId,
        eventType: "feedback.request.created",
        customerId: session.customerId,
        productId: session.productId,
        sessionId: session.id,
        properties: {
          feedbackRequestId: request.publicId,
          resultPublicId: result.publicId,
          externalOrderId:
            dto.external_order_id ?? null,
        },
      },
    });

    const baseUrl = (
      process.env.FIT_WEB_BASE_URL ??
      "http://localhost:3001"
    ).replace(/\/+$/, "");

    return {
      request_id: request.publicId,
      feedback_url: `${baseUrl}/f/${rawToken}`,
      status: request.status,
      expires_at: request.expiresAt,
    };
  }

  async getRequest(
    merchantId: string,
    publicId: string,
  ) {
    const request =
      await this.prisma.feedbackRequest.findFirst({
        where: {
          merchantId,
          publicId,
        },
        include: {
          product: true,
          fitResult: true,
          feedback: true,
        },
      });

    if (!request) {
      throw new NotFoundException(
        "Feedback request not found.",
      );
    }

    return {
      id: request.publicId,
      status: this.effectiveStatus(
        request.status,
        request.expiresAt,
      ),
      product_id: request.product.publicId,
      result_id:
        request.fitResult?.publicId ?? null,
      fit_score:
        request.fitResult?.score ?? null,
      actual_feedback: request.feedback
        ? {
            overall: request.feedback.overall,
            problem_areas:
              request.feedback.problemAreas,
            note: request.feedback.note,
            created_at:
              request.feedback.createdAt,
          }
        : null,
      external_order_id:
        request.externalOrderId,
      expires_at: request.expiresAt,
      completed_at: request.completedAt,
    };
  }

  async resolvePublicToken(rawToken: string) {
    const tokenHash = createHash("sha256")
      .update(rawToken)
      .digest("hex");

    const request =
      await this.prisma.feedbackRequest.findUnique({
        where: {
          publicTokenHash: tokenHash,
        },
        include: {
          merchant: true,
          product: true,
          fitSession: true,
          fitResult: true,
          feedback: true,
        },
      });

    if (
      !request ||
      request.expiresAt <= new Date() ||
      request.status === "EXPIRED" ||
      request.status === "CANCELLED"
    ) {
      throw new NotFoundException(
        "Feedback link is invalid or expired.",
      );
    }

    return request;
  }

  async getPublic(rawToken: string) {
    const request =
      await this.resolvePublicToken(rawToken);

    return {
      request_id: request.publicId,
      status: request.status,
      merchant: {
        name: request.merchant.name,
      },
      product: {
        id: request.product.publicId,
        name: request.product.name,
        brand: request.product.brand,
        category: request.product.category,
        original_size_label:
          request.product.originalSizeLabel,
      },
      prediction: request.fitResult
        ? {
            fit_score: request.fitResult.score,
            label: request.fitResult.label,
            confidence:
              request.fitResult.confidence,
            predicted_fit:
              request.fitResult.predictedFit,
            engine_version:
              request.fitResult.engineVersion,
          }
        : null,
      submitted: Boolean(request.feedback),
      return_url: request.returnUrl,
      expires_at: request.expiresAt,
    };
  }

  async submitPublic(
    rawToken: string,
    dto: SubmitFeedbackDto,
  ) {
    const request =
      await this.resolvePublicToken(rawToken);

    if (
      request.status === "COMPLETED" ||
      request.feedback
    ) {
      throw new ConflictException(
        "Feedback has already been submitted.",
      );
    }

    const problemAreas = [
      ...new Set(
        (dto.problem_areas ?? []).map((x) =>
          x.toUpperCase(),
        ),
      ),
    ];

    const invalid = problemAreas.filter(
      (area) =>
        !ALLOWED_PROBLEM_AREAS.has(area),
    );

    if (invalid.length) {
      throw new BadRequestException(
        `Unsupported problem area(s): ${invalid.join(", ")}`,
      );
    }

    if (
      dto.overall === "PERFECT" &&
      problemAreas.length > 0
    ) {
      throw new BadRequestException(
        "PERFECT feedback should not include problem areas.",
      );
    }

    const feedback =
      await this.prisma.$transaction(async (tx) => {
        const created =
          await tx.fitFeedback.create({
            data: {
              merchantId: request.merchantId,
              customerId: request.customerId,
              productId: request.productId,
              fitSessionId:
                request.fitSessionId,
              fitResultId:
                request.fitResultId,
              feedbackRequestId:
                request.id,
              overall: dto.overall,
              problemAreas,
              note: dto.note ?? null,
            },
          });

        await tx.feedbackRequest.update({
          where: { id: request.id },
          data: {
            status: "COMPLETED",
            completedAt: new Date(),
          },
        });

        await tx.analyticsEvent.create({
          data: {
            merchantId: request.merchantId,
            eventType: "feedback.received",
            customerId: request.customerId,
            productId: request.productId,
            sessionId: request.fitSessionId,
            properties: {
              feedbackId: created.publicId,
              feedbackRequestId:
                request.publicId,
              fitResultId:
                request.fitResult?.publicId ??
                null,
              predictedScore:
                request.fitResult?.score ?? null,
              predictedLabel:
                request.fitResult?.label ?? null,
              predictedFit:
                request.fitResult
                  ?.predictedFit ?? null,
              overall: created.overall,
              problemAreas:
                created.problemAreas,
            },
          },
        });

        return created;
      });

    await this.webhooks.emit(
      request.merchantId,
      "feedback.received",
      {
        feedback_id: feedback.publicId,
        feedback_request_id:
          request.publicId,
        session_id:
          request.fitSession?.publicId ?? null,
        result_id:
          request.fitResult?.publicId ?? null,
        product_id: request.product.publicId,
        external_order_id:
          request.externalOrderId,
        predicted_fit_score:
          request.fitResult?.score ?? null,
        predicted_label:
          request.fitResult?.label ?? null,
        overall: feedback.overall,
        problem_areas:
          feedback.problemAreas,
      },
    );

    return {
      feedback_id: feedback.publicId,
      status: "COMPLETED",
      message: "شكراً! صار September Fit أذكى.",
      return_url: request.returnUrl,
    };
  }

  async analytics(merchantId: string) {
    const feedback =
      await this.prisma.fitFeedback.findMany({
        where: { merchantId },
        include: {
          product: true,
          fitResult: true,
        },
      });

    const total = feedback.length;
    const count = (value: string) =>
      feedback.filter(
        (item) => item.overall === value,
      ).length;

    const perfect = count("PERFECT");
    const tooSmall = count("TOO_SMALL");
    const tooLarge = count("TOO_LARGE");

    const areaCounts: Record<string, number> = {};
    for (const item of feedback) {
      for (const area of item.problemAreas) {
        areaCounts[area] =
          (areaCounts[area] ?? 0) + 1;
      }
    }

    const scoreBuckets = [
      { name: "90-100", min: 90, max: 100 },
      { name: "80-89", min: 80, max: 89 },
      { name: "70-79", min: 70, max: 79 },
      { name: "60-69", min: 60, max: 69 },
      { name: "<60", min: 0, max: 59 },
    ].map((bucket) => {
      const rows = feedback.filter(
        (item) =>
          item.fitResult &&
          item.fitResult.score >= bucket.min &&
          item.fitResult.score <= bucket.max,
      );

      const perfectRows = rows.filter(
        (item) =>
          item.overall === "PERFECT",
      ).length;

      return {
        bucket: bucket.name,
        feedback_count: rows.length,
        perfect_count: perfectRows,
        perfect_rate:
          rows.length > 0
            ? Math.round(
                (perfectRows / rows.length) *
                  1000,
              ) / 10
            : 0,
      };
    });

    const byCategory = new Map<
      string,
      {
        total: number;
        perfect: number;
        tooSmall: number;
        tooLarge: number;
      }
    >();

    for (const item of feedback) {
      const category =
        item.product.category;
      const current =
        byCategory.get(category) ?? {
          total: 0,
          perfect: 0,
          tooSmall: 0,
          tooLarge: 0,
        };

      current.total += 1;
      if (item.overall === "PERFECT")
        current.perfect += 1;
      if (item.overall === "TOO_SMALL")
        current.tooSmall += 1;
      if (item.overall === "TOO_LARGE")
        current.tooLarge += 1;

      byCategory.set(category, current);
    }

    return {
      total_feedback: total,
      perfect_count: perfect,
      too_small_count: tooSmall,
      too_large_count: tooLarge,
      perfect_rate:
        total > 0
          ? Math.round(
              (perfect / total) * 1000,
            ) / 10
          : 0,
      too_small_rate:
        total > 0
          ? Math.round(
              (tooSmall / total) * 1000,
            ) / 10
          : 0,
      too_large_rate:
        total > 0
          ? Math.round(
              (tooLarge / total) * 1000,
            ) / 10
          : 0,
      problem_areas: Object.entries(
        areaCounts,
      )
        .map(([area, count]) => ({
          area,
          count,
        }))
        .sort((a, b) => b.count - a.count),
      score_buckets: scoreBuckets,
      categories: Array.from(
        byCategory.entries(),
      ).map(([category, values]) => ({
        category,
        ...values,
        perfect_rate:
          values.total > 0
            ? Math.round(
                (values.perfect /
                  values.total) *
                  1000,
              ) / 10
            : 0,
      })),
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
    if (
      status === "CREATED" &&
      expiresAt <= new Date()
    ) {
      return "EXPIRED";
    }
    return status;
  }
}
