import {
  BadRequestException,
  CallHandler,
  ConflictException,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { createHash } from "node:crypto";
import type { Response } from "express";
import type { Observable } from "rxjs";
import { of, tap } from "rxjs";
import type { AuthenticatedRequest } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";

function stableJson(value: unknown): string {
  if (value === undefined) return "null";

  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "null";
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }

  const object = value as Record<string, unknown>;
  const keys = Object.keys(object).sort();

  return `{${keys
    .map(
      (key) =>
        `${JSON.stringify(key)}:${stableJson(object[key])}`,
    )
    .join(",")}}`;
}

function jsonSafe(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(
    JSON.stringify(value ?? null),
  ) as Prisma.InputJsonValue;
}

@Injectable()
export class IdempotencyInterceptor
  implements NestInterceptor
{
  private readonly logger = new Logger(
    IdempotencyInterceptor.name,
  );

  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const http = context.switchToHttp();
    const request =
      http.getRequest<AuthenticatedRequest>();
    const response = http.getResponse<Response>();

    const method = request.method?.toUpperCase();

    if (
      !["POST", "PUT", "PATCH", "DELETE"].includes(
        method,
      )
    ) {
      return next.handle();
    }

    const merchantId =
      request.merchant?.merchantId;
    const key = request
      .header("idempotency-key")
      ?.trim();

    if (!merchantId || !key) {
      return next.handle();
    }

    if (key.length > 255) {
      throw new BadRequestException(
        "Idempotency-Key must be 255 characters or fewer.",
      );
    }

    const requestHash = createHash("sha256")
      .update(
        stableJson({
          method,
          path: request.originalUrl,
          body: request.body ?? null,
        }),
      )
      .digest("hex");

    const replayOrConflict = async () => {
      const existing =
        await this.prisma.idempotencyKey.findUnique({
          where: {
            merchantId_key: {
              merchantId,
              key,
            },
          },
        });

      if (!existing) return null;

      if (existing.requestHash !== requestHash) {
        throw new ConflictException(
          "Idempotency-Key was already used with a different request.",
        );
      }

      if (
        existing.responseCode !== null &&
        existing.responseBody !== null
      ) {
        response.status(existing.responseCode);
        return of(existing.responseBody);
      }

      throw new ConflictException(
        "An identical request with this Idempotency-Key is already in progress.",
      );
    };

    const existingResult = await replayOrConflict();
    if (existingResult) return existingResult;

    let record: { id: string };

    try {
      record =
        await this.prisma.idempotencyKey.create({
          data: {
            merchantId,
            key,
            requestHash,
            expiresAt: new Date(
              Date.now() +
                24 * 60 * 60 * 1000,
            ),
          },
          select: { id: true },
        });
    } catch (error) {
      if (
        error instanceof
          Prisma.PrismaClientKnownRequestError &&
        (error as { code?: string }).code === "P2002"
      ) {
        const raced = await replayOrConflict();
        if (raced) return raced;
      }
      throw error;
    }

    return next.handle().pipe(
      tap({
        next: (body) => {
          void this.prisma.idempotencyKey
            .update({
              where: { id: record.id },
              data: {
                responseCode:
                  response.statusCode,
                responseBody: jsonSafe(body),
              },
            })
            .catch((error: unknown) => {
              this.logger.error(
                "Failed to persist idempotency response.",
                error,
              );
            });
        },
        error: () => {
          void this.prisma.idempotencyKey
            .delete({
              where: { id: record.id },
            })
            .catch(() => undefined);
        },
      }),
    );
  }
}
